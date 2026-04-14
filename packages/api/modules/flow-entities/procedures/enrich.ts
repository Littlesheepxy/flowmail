import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import {
	classifyEmail,
	classifyEmailDynamic,
	extractApprovalFields,
	extractReportFields,
	summarizeThread,
	generateSuggestions,
	generateTags,
} from "@repo/email-processor";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { z } from "zod";

const SLUG_TO_ENTITY_TYPE: Record<string, string> = {
	approval: "APPROVAL",
	report: "REPORT",
	issue: "ISSUE",
	feedback: "FEEDBACK",
};

const enrichEntitySchema = z.object({
	entityId: z.string(),
});

export const enrichEntity = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/{entityId}/enrich",
		tags: ["FlowEntities"],
		summary: "Run AI classification + extraction on an entity",
	})
	.input(enrichEntitySchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
			include: {
				threads: {
					select: {
						subject: true,
						sender: true,
						senderName: true,
						bodyText: true,
						bodyHtml: true,
						snippet: true,
					},
					orderBy: { receivedAt: "desc" },
					take: 3,
				},
			},
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND", { message: "Entity not found" });
		}

		await requireOrgMembershipForResource(entity.organizationId, context.user.id);

		if (entity.threads.length === 0) {
			throw new ORPCError("BAD_REQUEST", { message: "No email threads to analyze" });
		}

		const primaryThread = entity.threads[0];
		const content = primaryThread.bodyText
			?? primaryThread.snippet
			?? "";
		const subject = primaryThread.subject ?? entity.title;
		const sender = primaryThread.senderName ?? primaryThread.sender ?? "";

		const orgCategories = await db.category.findMany({
			where: { organizationId: entity.organizationId },
			select: { id: true, name: true, slug: true, aiPrompt: true },
			orderBy: { sortOrder: "asc" },
		});

		let categoryId: string | undefined;
		let categorySlug: string | undefined;
		let entityType = "FEEDBACK";
		let confidence = 0;
		let reasoning = "";
		let extractedFields: Record<string, unknown> = {};

		const useDynamic = orgCategories.length > 0;

		if (useDynamic) {
			const cats = orgCategories.map((c) => ({
				...c,
				aiPrompt: c.aiPrompt ?? "",
			}));
			const result = await classifyEmailDynamic(
				{ subject, sender, content },
				cats,
			);
			categorySlug = result.categorySlug;
			confidence = result.confidence;
			reasoning = result.reasoning;

			const matched = orgCategories.find((c) => c.slug === categorySlug);
			categoryId = matched?.id;
			entityType = SLUG_TO_ENTITY_TYPE[categorySlug] ?? "FEEDBACK";
		} else {
			const result = await classifyEmail(
				{ subject, sender, content },
			);

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

		const validEntityType = (["APPROVAL", "REPORT", "ISSUE", "FEEDBACK"] as const).includes(
			entityType as "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK",
		)
			? (entityType as "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK")
			: "FEEDBACK";

		const initialStatus = determineStatus(
			categorySlug ?? entityType.toLowerCase(),
			extractedFields,
		);

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
				updatedAt: new Date(),
			},
		});

		let suggestions: unknown[] = [];
		try {
			suggestions = await generateSuggestions({
				entityType,
				entityStatus: initialStatus,
				extractedFields,
				latestEmailContent: content.slice(0, 2000),
				timelineSummary: summary,
				availableTools: [
					"add_timeline_event",
					"approve_entity",
					"reject_entity",
					"update_entity_status",
				],
			});
		} catch {
			// non-critical
		}

		await db.timelineEvent.create({
			data: {
				entityId: entity.id,
				type: "ai_summary",
				content: `AI classified as ${categorySlug ?? entityType} (${Math.round(confidence * 100)}%): ${summary}`,
				metadata: JSON.stringify({
					categorySlug,
					categoryId,
					confidence,
					reasoning,
					extractedFields,
					...(suggestions.length > 0 ? { suggestions } : {}),
				}),
			},
		});

		try {
			const tagNames = await generateTags({
				subject,
				content,
				sender,
				extractedFields,
			});
			for (const tagName of tagNames) {
				const tag = await db.tag.upsert({
					where: {
						organizationId_name: {
							organizationId: entity.organizationId,
							name: tagName,
						},
					},
					create: { organizationId: entity.organizationId, name: tagName, source: "AI" },
					update: {},
				});
				await db.entityTag.upsert({
					where: { entityId_tagId: { entityId: entity.id, tagId: tag.id } },
					create: { entityId: entity.id, tagId: tag.id },
					update: {},
				});
			}
		} catch {
			// non-critical
		}

		return {
			entityId: entity.id,
			type: validEntityType,
			categorySlug,
			confidence,
			summary,
		};
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
