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

export interface InboundAttachment {
	filename: string;
	mimeType?: string;
	size?: number;
	externalId: string;
	contentId?: string;
	storageKey?: string; // S3 key if already uploaded by caller
}

interface InboundEmailInput {
	organizationId: string;
	fromEmail: string;
	subject: string;
	textBody?: string;
	htmlBody?: string;
	rawHeaders?: string;
	rawPayload?: unknown;
	attachments?: InboundAttachment[];
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

		// ── Dedup check ──────────────────────────────────────────────────────────
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

		// ── Step 1: 立即写库，前台秒显示 ──────────────────────────────────────────
		// 不等 AI，先用 subject 作为 title、FEEDBACK 作为默认类型创建 entity + thread
		const entityTitle =
			input.subject.replace(/^(Fwd?:|Fw:|转发：)\s*/gi, "").trim() ||
			"Untitled";

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

		const entity = await db.flowEntity.create({
			data: {
				organizationId: input.organizationId,
				type: "FEEDBACK" as never,
				title: entityTitle,
				status: "pending",
				extractedFields: JSON.stringify({}),
				aiSummary: "",
				aiConfidence: 0,
				requiresReview: true,
			},
		});

		await db.inboundEmail.update({
			where: { id: inboundEmail.id },
			data: { entityId: entity.id, processedAt: new Date() },
		});

		// Create email_thread so frontend can display the email immediately
		let thread: { id: string };
		try {
			thread = await db.emailThread.create({
				data: {
					organizationId: input.organizationId,
					entityId: entity.id,
					externalThreadId: inboundEmail.id,
					subject: input.subject,
					sender: input.fromEmail,
					senderName: input.fromEmail.split("@")[0],
					snippet: (input.textBody || stripHtml(input.htmlBody || "")).slice(0, 200),
					bodyHtml: input.htmlBody,
					bodyText: input.textBody,
					messageId: (input.rawPayload as Record<string, unknown>)?.message_id as string | undefined,
					participants: JSON.stringify([input.fromEmail]),
					receivedAt: new Date(),
				},
			});
		} catch (threadError) {
			console.error("[inbound] Failed to create email_thread:", {
				entityId: entity.id,
				inboundEmailId: inboundEmail.id,
				error: threadError instanceof Error ? threadError.message : String(threadError),
			});
			// Fallback with unique externalThreadId
			thread = await db.emailThread.create({
				data: {
					organizationId: input.organizationId,
					entityId: entity.id,
					externalThreadId: `${inboundEmail.id}-fallback`,
					subject: input.subject,
					sender: input.fromEmail,
					senderName: input.fromEmail.split("@")[0],
					snippet: (input.textBody || stripHtml(input.htmlBody || "")).slice(0, 200),
					bodyText: input.textBody || "[邮件内容请查看附件]",
					participants: JSON.stringify([input.fromEmail]),
					receivedAt: new Date(),
				},
			});
		}

		// Create attachment records
		if (input.attachments && input.attachments.length > 0) {
			await db.emailAttachment.createMany({
				data: input.attachments.map((att) => ({
					threadId: thread.id,
					filename: att.filename,
					mimeType: att.mimeType,
					size: att.size,
					externalId: att.externalId,
					contentId: att.contentId,
					storageKey: att.storageKey,
				})),
			});
		}

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

		// ── Step 2: 后台异步 AI 处理，不阻塞响应 ─────────────────────────────────
		// 用 void + 独立 async 函数，失败不影响已显示的 entity
		void enrichEntityWithAI({
			entityId: entity.id,
			inboundEmailId: inboundEmail.id,
			organizationId: input.organizationId,
			subject: input.subject,
			fromEmail: input.fromEmail,
			content,
		});

		return {
			success: true,
			duplicate: false,
			inboundEmailId: inboundEmail.id,
			entityId: entity.id,
			entityTitle,
			categorySlug: "feedback",
		};
	} catch (error) {
		return {
			success: false,
			duplicate: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// ── 异步 AI 增强：分类、提取字段、生成摘要，然后更新 entity ─────────────────────
async function enrichEntityWithAI(params: {
	entityId: string;
	inboundEmailId: string;
	organizationId: string;
	subject: string;
	fromEmail: string;
	content: string;
}) {
	const hasAiKey = !!(
		process.env.OPENAI_API_KEY ||
		process.env.ANTHROPIC_API_KEY ||
		process.env.ANTHROPIC_AUTH_TOKEN ||
		process.env.AI_GATEWAY_API_KEY
	);

	if (!hasAiKey) { return; }

	try {
		const orgCategories = await db.category.findMany({
			where: { organizationId: params.organizationId },
			select: { id: true, name: true, slug: true, aiPrompt: true },
			orderBy: { sortOrder: "asc" },
		});

		let categoryId: string | undefined;
		let categorySlug = "feedback";
		let entityType = "FEEDBACK";
		let confidence = 0.5;
		let extractedFields: Record<string, unknown> = {};

		if (orgCategories.length > 0) {
			const result = await classifyEmailDynamic(
				{
					subject: params.subject,
					sender: params.fromEmail,
					content: params.content,
				},
				orgCategories as CategoryDefinition[],
			);
			categorySlug = result.categorySlug === "unknown" ? "feedback" : result.categorySlug;
			confidence = result.confidence;
			const matched = orgCategories.find((c) => c.slug === categorySlug);
			categoryId = matched?.id;
			entityType = SLUG_TO_ENTITY_TYPE[categorySlug] ?? "FEEDBACK";
		} else {
			const result = await classifyEmailWithMemory(
				{
					subject: params.subject,
					sender: params.fromEmail,
					content: params.content,
				},
				params.organizationId,
				memoryManager,
			);
			entityType = result.type === "UNKNOWN" ? "FEEDBACK" : result.type;
			confidence = result.type === "UNKNOWN" ? 0.5 : result.confidence;
			categorySlug = entityType.toLowerCase();
		}

		if (entityType === "APPROVAL" || categorySlug === "approval") {
			extractedFields = await extractApprovalFields(params.content);
		} else if (entityType === "REPORT" || categorySlug === "report") {
			extractedFields = await extractReportFields(params.content);
		}

		const summary = await summarizeThread(params.content);

		// Update entity with AI results
		await db.flowEntity.update({
			where: { id: params.entityId },
			data: {
				type: entityType as never,
				categoryId,
				extractedFields: JSON.stringify(extractedFields),
				aiSummary: summary,
				aiConfidence: confidence,
				requiresReview: confidence < 0.7,
			},
		});

		// Add AI classification timeline event
		await db.timelineEvent.create({
			data: {
				entityId: params.entityId,
				type: "ai_summary",
				content: `AI 已完成分类：${entityType}（置信度 ${Math.round(confidence * 100)}%）${summary ? `\n\n${summary}` : ""}`,
				metadata: JSON.stringify({
					entityType,
					categorySlug,
					confidence,
				}),
			},
		});
	} catch (err) {
		console.error("[inbound] AI enrichment failed:", {
			entityId: params.entityId,
			error: err instanceof Error ? err.message : String(err),
		});
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
