import { db } from "@repo/database";
import { createHash } from "node:crypto";
import {
	classifyEmailDynamic,
	classifyEmailWithMemory,
	type CategoryDefinition,
} from "./classifier";
import { extractApprovalFields, extractReportFields } from "./extractor";
import { summarizeThread } from "./summarizer";
import { MemoryManager } from "@repo/agent";

const memoryManager = new MemoryManager();

interface InboundEmailInput {
	organizationId: string;
	fromEmail: string;
	subject: string;
	textBody?: string;
	htmlBody?: string;
	rawHeaders?: string;
	rawPayload?: unknown;
}

interface InboundProcessResult {
	success: boolean;
	inboundEmailId?: string;
	entityId?: string;
	entityTitle?: string;
	categorySlug?: string;
	aiSummary?: string;
	duplicate: boolean;
	error?: string;
}

const SLUG_TO_ENTITY_TYPE: Record<string, string> = {
	approval: "APPROVAL",
	report: "REPORT",
	issue: "ISSUE",
	feedback: "FEEDBACK",
};

export function computeContentHash(
	subject: string,
	sender: string,
	receivedAt: Date,
): string {
	const minuteKey = `${receivedAt.getFullYear()}-${receivedAt.getMonth()}-${receivedAt.getDate()}-${receivedAt.getHours()}-${receivedAt.getMinutes()}`;
	const raw = `${subject.trim().toLowerCase()}|${sender.trim().toLowerCase()}|${minuteKey}`;
	return createHash("sha256").update(raw).digest("hex");
}

export async function processInboundEmail(
	input: InboundEmailInput,
): Promise<InboundProcessResult> {
	try {
		const content = input.textBody || stripHtml(input.htmlBody || "") || "";
		const contentHash = computeContentHash(
			input.subject,
			input.fromEmail,
			new Date(),
		);

		const existingByHash = await db.inboundEmail.findUnique({
			where: { contentHash },
		});
		if (existingByHash) {
			return {
				success: true,
				duplicate: true,
				inboundEmailId: existingByHash.id,
				entityId: existingByHash.entityId ?? undefined,
			};
		}

		const existingByThread = await db.emailThread.findFirst({
			where: {
				organizationId: input.organizationId,
				OR: [
					{
						subject: { contains: normalizeSubject(input.subject) },
						sender: input.fromEmail,
					},
				],
				entityId: { not: null },
			},
			orderBy: { receivedAt: "desc" },
			select: { entityId: true },
		});

		if (existingByThread?.entityId) {
			return {
				success: true,
				duplicate: true,
				entityId: existingByThread.entityId,
				inboundEmailId: undefined,
			};
		}

		const inboundEmail = await db.inboundEmail.create({
			data: {
				organizationId: input.organizationId,
				fromEmail: input.fromEmail,
				subject: input.subject,
				textBody: input.textBody,
				htmlBody: input.htmlBody,
				rawHeaders: input.rawHeaders,
				rawPayload: input.rawPayload as never,
				contentHash,
			},
		});

		const orgCategories = await db.category.findMany({
			where: { organizationId: input.organizationId },
			select: { id: true, name: true, slug: true, aiPrompt: true },
			orderBy: { sortOrder: "asc" },
		});

		let categoryId: string | undefined;
		let categorySlug: string | undefined;
		let entityType = "FEEDBACK";
		let confidence = 0;
		let extractedFields: Record<string, unknown> = {};
		let summary: string = content.slice(0, 200);
		let requiresReview = true;

		const hasAiKey = !!process.env.OPENAI_API_KEY;

		if (hasAiKey) {
			const useDynamic = orgCategories.length > 0;

			if (useDynamic) {
				const result = await classifyEmailDynamic(
					{
						subject: input.subject,
						sender: input.fromEmail,
						content,
					},
					orgCategories as CategoryDefinition[],
				);

				categorySlug = result.categorySlug;
				confidence = result.confidence;

				const matched = orgCategories.find(
					(c) => c.slug === categorySlug,
				);
				categoryId = matched?.id;
				entityType =
					SLUG_TO_ENTITY_TYPE[categorySlug] ??
					(categorySlug === "unknown" ? "FEEDBACK" : "FEEDBACK");
			} else {
				const result = await classifyEmailWithMemory(
					{
						subject: input.subject,
						sender: input.fromEmail,
						content,
					},
					input.organizationId,
					memoryManager,
				);

				if (result.type === "UNKNOWN") {
					return {
						success: true,
						duplicate: false,
						inboundEmailId: inboundEmail.id,
					};
				}

				entityType = result.type;
				confidence = result.confidence;
				categorySlug = result.type.toLowerCase();
			}

			if (categorySlug === "unknown" && !categoryId) {
				return {
					success: true,
					duplicate: false,
					inboundEmailId: inboundEmail.id,
				};
			}

			requiresReview = confidence < 0.7;

			if (entityType === "APPROVAL" || categorySlug === "approval") {
				extractedFields = await extractApprovalFields(content);
			} else if (entityType === "REPORT" || categorySlug === "report") {
				extractedFields = await extractReportFields(content);
			}

			summary = await summarizeThread(content);
		} else {
			const uncategorized =
				orgCategories.find((c) => c.slug === "uncategorized") ??
				orgCategories[0];
			if (uncategorized) {
				categoryId = uncategorized.id;
				categorySlug = uncategorized.slug;
			}
		}

		const entityTitle =
			input.subject.replace(/^(Fwd?:|Fw:|转发：)\s*/gi, "").trim() ||
			"Untitled";

		const entity = await db.flowEntity.create({
			data: {
				organizationId: input.organizationId,
				type: entityType as never,
				categoryId,
				title: entityTitle,
				status: "pending",
				extractedFields: JSON.stringify(extractedFields),
				aiSummary: summary,
				aiConfidence: confidence,
				requiresReview,
			},
		});

		await db.inboundEmail.update({
			where: { id: inboundEmail.id },
			data: { entityId: entity.id, processedAt: new Date() },
		});

		await db.timelineEvent.create({
			data: {
				entityId: entity.id,
				type: "email_received",
				content: `Inbound email from ${input.fromEmail}: ${input.subject}`,
				metadata: JSON.stringify({
					source: "inbound",
					fromEmail: input.fromEmail,
					subject: input.subject,
				}),
			},
		});

		return {
			success: true,
			duplicate: false,
			inboundEmailId: inboundEmail.id,
			entityId: entity.id,
			entityTitle,
			categorySlug,
			aiSummary: summary,
		};
	} catch (error) {
		return {
			success: false,
			duplicate: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

function normalizeSubject(subject: string): string {
	return subject
		.replace(/^(Re:|Fwd?:|Fw:|回复：|转发：)\s*/gi, "")
		.trim();
}

function stripHtml(html: string): string {
	return html
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}
