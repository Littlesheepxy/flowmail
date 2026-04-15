import { db } from "@repo/database";
import {
	classifyEmail,
	classifyEmailDynamic,
	extractApprovalFields,
	extractReportFields,
	summarizeThread,
	generateTags,
} from "@repo/email-processor";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { z } from "zod";

const SLUG_TO_ENTITY_TYPE: Record<string, string> = {
	approval: "APPROVAL",
	report: "REPORT",
	issue: "ISSUE",
	feedback: "FEEDBACK",
	noise: "NOISE",
};

const enrichBatchSchema = z.object({
	organizationId: z.string(),
	entityIds: z.array(z.string()).optional(),
	limit: z.number().min(1).max(50).default(20),
});

export const enrichBatch = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/enrich-batch",
		tags: ["FlowEntities"],
		summary: "Batch AI analysis for unanalyzed entities",
	})
	.input(enrichBatchSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const where = {
			organizationId: input.organizationId,
			aiSummary: null as string | null,
			...(input.entityIds ? { id: { in: input.entityIds } } : {}),
		};

		const entities = await db.flowEntity.findMany({
			where,
			include: {
				threads: {
					select: {
						subject: true,
						sender: true,
						senderName: true,
						bodyText: true,
						snippet: true,
					},
					orderBy: { receivedAt: "desc" },
					take: 3,
				},
			},
			orderBy: { createdAt: "desc" },
			take: input.limit,
		});

		if (entities.length === 0) {
			return { total: 0, succeeded: 0, failed: 0, results: [] };
		}

		const orgCategories = await db.category.findMany({
			where: { organizationId: input.organizationId },
			select: { id: true, name: true, slug: true, aiPrompt: true },
			orderBy: { sortOrder: "asc" },
		});

		const useDynamic = orgCategories.length > 0;
		const cats = useDynamic
			? orgCategories.map((c) => ({ ...c, aiPrompt: c.aiPrompt ?? "" }))
			: [];

		const LOG_TAG = "[EnrichBatch]";
		console.info(`${LOG_TAG} Starting org=${input.organizationId} count=${entities.length}`);

		const results: { entityId: string; status: "ok" | "error"; categorySlug?: string; error?: string }[] = [];

		for (const entity of entities) {
			try {
				if (entity.threads.length === 0) {
					console.warn(`${LOG_TAG} Skipped entity=${entity.id} — no threads`);
					results.push({ entityId: entity.id, status: "error", error: "No threads" });
					continue;
				}

				const primaryThread = entity.threads[0];
				const content = primaryThread.bodyText ?? primaryThread.snippet ?? "";
				const subject = primaryThread.subject ?? entity.title;
				const sender = primaryThread.senderName ?? primaryThread.sender ?? "";

				let categoryId: string | undefined;
				let categorySlug: string | undefined;
				let entityType = "FEEDBACK";
				let confidence = 0;
				let reasoning = "";
				let extractedFields: Record<string, unknown> = {};

				if (useDynamic) {
					const result = await classifyEmailDynamic({ subject, sender, content }, cats);
					categorySlug = result.categorySlug;
					confidence = result.confidence;
					reasoning = result.reasoning;
					const matched = orgCategories.find((c) => c.slug === categorySlug);
					categoryId = matched?.id;
					entityType = SLUG_TO_ENTITY_TYPE[categorySlug] ?? "FEEDBACK";
				} else {
					const result = await classifyEmail({ subject, sender, content });
					entityType = result.type;
					confidence = result.confidence;
					reasoning = result.reasoning;
					categorySlug = result.type.toLowerCase();
				}

				if (entityType === "APPROVAL" || categorySlug === "approval") {
					extractedFields = await extractApprovalFields(content);
				} else if (entityType === "REPORT" || categorySlug === "report") {
					extractedFields = await extractReportFields(content);
				}

				const summary = await summarizeThread(content);

				const validEntityType = (["APPROVAL", "REPORT", "ISSUE", "FEEDBACK", "NOISE"] as const).includes(
					entityType as "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK" | "NOISE",
				)
					? (entityType as "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK" | "NOISE")
					: "FEEDBACK";

				const initialStatus = determineStatus(categorySlug ?? entityType.toLowerCase(), extractedFields);

				await db.flowEntity.update({
					where: { id: entity.id },
					data: {
						type: validEntityType,
						categoryId: categoryId ?? undefined,
						title: (extractedFields as { title?: string }).title ?? entity.title,
						status: initialStatus,
						extractedFields: JSON.stringify(extractedFields),
						aiSummary: summary,
						aiConfidence: confidence,
						requiresReview: confidence < 0.7,
						isFiltered: validEntityType === "NOISE",
						updatedAt: new Date(),
					},
				});

				await db.timelineEvent.create({
					data: {
						entityId: entity.id,
						type: "ai_summary",
						content: `AI classified as ${categorySlug ?? entityType} (${Math.round(confidence * 100)}%): ${summary}`,
						metadata: JSON.stringify({ categorySlug, categoryId, confidence, reasoning, extractedFields }),
					},
				});

				try {
					const tagNames = await generateTags({ subject, content, sender, extractedFields });
					for (const tagName of tagNames) {
						const tag = await db.tag.upsert({
							where: { organizationId_name: { organizationId: entity.organizationId, name: tagName } },
							create: { organizationId: entity.organizationId, name: tagName, source: "AI" },
							update: {},
						});
						await db.entityTag.upsert({
							where: { entityId_tagId: { entityId: entity.id, tagId: tag.id } },
							create: { entityId: entity.id, tagId: tag.id },
							update: {},
						});
					}
				} catch (err) {
					console.warn(`${LOG_TAG} Tags failed (non-critical) entity=${entity.id}`, {
						error: err instanceof Error ? err.message : String(err),
					});
				}

				console.info(`${LOG_TAG} OK entity=${entity.id} → ${categorySlug} (${Math.round(confidence * 100)}%)`);
				results.push({ entityId: entity.id, status: "ok", categorySlug });
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : "Unknown error";
				console.error(`${LOG_TAG} FAILED entity=${entity.id}`, {
					error: errorMsg,
					stack: err instanceof Error ? err.stack : undefined,
				});
				results.push({
					entityId: entity.id,
					status: "error",
					error: errorMsg,
				});
			}
		}

		const succeeded = results.filter((r) => r.status === "ok").length;
		const failed = results.filter((r) => r.status === "error").length;
		console.info(`${LOG_TAG} Done org=${input.organizationId} total=${entities.length} succeeded=${succeeded} failed=${failed}`);

		return { total: entities.length, succeeded, failed, results };
	});

function determineStatus(slug: string, fields: Record<string, unknown>): string {
	switch (slug) {
		case "approval":
			return "pending";
		case "report": {
			const s = (fields as { overallStatus?: string }).overallStatus;
			return s === "blocked" ? "blocked" : "in_progress";
		}
		case "issue":
			return "open";
		case "feedback":
			return "received";
		default:
			return "pending";
	}
}
