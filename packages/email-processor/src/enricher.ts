import { db } from "@repo/database";
import { classifyEmail, classifyEmailDynamic } from "./classifier";
import { extractApprovalFields, extractReportFields } from "./extractor";
import { summarizeThread } from "./summarizer";
import { generateTags } from "./tagger";

const SLUG_TO_ENTITY_TYPE: Record<string, string> = {
	approval: "APPROVAL",
	report: "REPORT",
	issue: "ISSUE",
	feedback: "FEEDBACK",
	noise: "NOISE",
};

export async function enrichEntityById(entityId: string): Promise<{
	entityId: string;
	type: string;
	categorySlug?: string;
	confidence: number;
	summary: string;
}> {
	const LOG_TAG = "[Enricher]";

	const entity = await db.flowEntity.findUnique({
		where: { id: entityId },
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
	});

	if (!entity) {
		throw new Error(`Entity ${entityId} not found`);
	}

	if (entity.threads.length === 0) {
		throw new Error(`Entity ${entityId} has no threads`);
	}

	const primaryThread = entity.threads[0];
	const content = primaryThread.bodyText ?? primaryThread.snippet ?? "";
	const subject = primaryThread.subject ?? entity.title;
	const sender = primaryThread.senderName ?? primaryThread.sender ?? "";

	console.info(`${LOG_TAG} Starting entity=${entityId} subject="${subject.slice(0, 60)}" sender="${sender}"`);

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

	try {
		if (useDynamic) {
			const cats = orgCategories.map((c) => ({
				...c,
				aiPrompt: c.aiPrompt ?? "",
			}));
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
		console.info(`${LOG_TAG} Classified entity=${entityId} → ${categorySlug} (${Math.round(confidence * 100)}%)`);
	} catch (err) {
		console.error(`${LOG_TAG} Classification FAILED entity=${entityId}`, {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
			useDynamic,
			contentLength: content.length,
		});
		throw err;
	}

	try {
		if (entityType === "APPROVAL" || categorySlug === "approval") {
			extractedFields = await extractApprovalFields(content);
		} else if (entityType === "REPORT" || categorySlug === "report") {
			extractedFields = await extractReportFields(content);
		}
		console.info(`${LOG_TAG} Extracted entity=${entityId} type=${entityType} fields=${Object.keys(extractedFields).length}`);
	} catch (err) {
		console.error(`${LOG_TAG} Extraction FAILED entity=${entityId} type=${entityType}`, {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		throw err;
	}

	let summary: string;
	try {
		summary = await summarizeThread(content);
		console.info(`${LOG_TAG} Summarized entity=${entityId} length=${summary.length}`);
	} catch (err) {
		console.error(`${LOG_TAG} Summarization FAILED entity=${entityId}`, {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		throw err;
	}

	const validEntityType = (["APPROVAL", "REPORT", "ISSUE", "FEEDBACK", "NOISE"] as const).includes(
		entityType as "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK" | "NOISE",
	)
		? (entityType as "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK" | "NOISE")
		: "FEEDBACK";

	const isFiltered = validEntityType === "NOISE";
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
			isFiltered,
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
		console.warn(`${LOG_TAG} Tags failed (non-critical) entity=${entityId}`, {
			error: err instanceof Error ? err.message : String(err),
		});
	}

	console.info(`${LOG_TAG} Completed entity=${entityId} → ${categorySlug} confidence=${Math.round(confidence * 100)}%`);

	return {
		entityId: entity.id,
		type: validEntityType,
		categorySlug,
		confidence,
		summary,
	};
}

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
		case "noise":
			return "filtered";
		default:
			return "pending";
	}
}
