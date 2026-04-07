import { db } from "@repo/database";
import { MemoryManager } from "@repo/agent";
import {
	classifyEmailDynamic,
	classifyEmailWithMemory,
	type CategoryDefinition,
} from "./classifier";
import { extractApprovalFields, extractReportFields } from "./extractor";
import { generateSuggestions } from "./suggester";
import { summarizeThread } from "./summarizer";

import type { EmailRecipient, RawEmailAttachment } from "./connectors/types";

const memoryManager = new MemoryManager();

interface EmailInput {
	threadId: string;
	subject: string;
	sender: string;
	senderEmail: string;
	content: string;
	bodyHtml?: string;
	bodyText?: string;
	toRecipients?: EmailRecipient[];
	ccRecipients?: EmailRecipient[];
	attachments?: RawEmailAttachment[];
	organizationId: string;
	connectionId: string;
	externalThreadId: string;
	receivedAt: Date;
	messageId?: string;
}

interface ProcessResult {
	success: boolean;
	entityId?: string;
	classification?: string;
	categorySlug?: string;
	error?: string;
	requiresManualReview: boolean;
}

const SLUG_TO_ENTITY_TYPE: Record<string, string> = {
	approval: "APPROVAL",
	report: "REPORT",
	issue: "ISSUE",
	feedback: "FEEDBACK",
};

export async function processEmail(input: EmailInput): Promise<ProcessResult> {
	try {
		const orgCategories = await db.category.findMany({
			where: { organizationId: input.organizationId },
			select: { id: true, name: true, slug: true, aiPrompt: true },
			orderBy: { sortOrder: "asc" },
		});

		let categoryId: string | undefined;
		let categorySlug: string | undefined;
		let entityType = "FEEDBACK";
		let confidence = 0;
		let reasoning = "";
		let extractedFields: Record<string, unknown> = {};
		let summary: string = input.content.slice(0, 200);
		let requiresReview = true;

		const hasAiKey = !!process.env.OPENAI_API_KEY;

		if (hasAiKey) {
			const useDynamic = orgCategories.length > 0;

			if (useDynamic) {
				const result = await classifyEmailDynamic(
					{
						subject: input.subject,
						sender: input.sender,
						content: input.content,
					},
					orgCategories as CategoryDefinition[],
				);

				categorySlug = result.categorySlug;
				confidence = result.confidence;
				reasoning = result.reasoning;

				const matched = orgCategories.find((c) => c.slug === categorySlug);
				categoryId = matched?.id;
				entityType =
					SLUG_TO_ENTITY_TYPE[categorySlug] ??
					(categorySlug === "unknown" ? "FEEDBACK" : "FEEDBACK");
			} else {
				const result = await classifyEmailWithMemory(
					{
						subject: input.subject,
						sender: input.sender,
						content: input.content,
					},
					input.organizationId,
					memoryManager,
				);

				if (result.type === "UNKNOWN") {
					return {
						success: true,
						classification: "UNKNOWN",
						requiresManualReview: true,
					};
				}

				entityType = result.type;
				confidence = result.confidence;
				reasoning = result.reasoning;
				categorySlug = result.type.toLowerCase();
			}

			if (categorySlug === "unknown" && !categoryId) {
				return {
					success: true,
					classification: "UNKNOWN",
					categorySlug: "unknown",
					requiresManualReview: true,
				};
			}

			requiresReview = confidence < 0.7;

			if (entityType === "APPROVAL" || categorySlug === "approval") {
				extractedFields = await extractApprovalFields(input.content);
			} else if (entityType === "REPORT" || categorySlug === "report") {
				extractedFields = await extractReportFields(input.content);
			}

			summary = await summarizeThread(input.content);
		} else {
			const uncategorized = orgCategories.find((c) => c.slug === "uncategorized") ?? orgCategories[0];
			if (uncategorized) {
				categoryId = uncategorized.id;
				categorySlug = uncategorized.slug;
			}
		}

		// ─── 聚合查找：优先复用已有 Entity ───

		// 层级1：精确匹配 externalThreadId（同一对话链）
		const existingByThread = await db.emailThread.findFirst({
			where: {
				connectionId: input.connectionId,
				externalThreadId: input.externalThreadId,
				entityId: { not: null },
			},
			select: { entityId: true },
		});

		let existingEntityId: string | null = existingByThread?.entityId ?? null;

		// 层级2：同发件人 + 规范化主题（30天内）
		if (!existingEntityId) {
			const normalizedSubject = input.subject
				.replace(/^(Re:|Fwd:|Fw:|回复：|转发：)\s*/gi, "")
				.trim();
			const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			const existingByContact = await db.emailThread.findFirst({
				where: {
					organizationId: input.organizationId,
					sender: input.senderEmail,
					subject: { contains: normalizedSubject },
					receivedAt: { gte: cutoff },
					entityId: { not: null },
				},
				orderBy: { receivedAt: "desc" },
				select: { entityId: true },
			});
			existingEntityId = existingByContact?.entityId ?? null;
		}

		// ─── 追加到已有 Entity ───
		if (existingEntityId) {
			const allParticipants = [
				input.senderEmail,
				...(input.toRecipients?.map((r) => r.address) ?? []),
				...(input.ccRecipients?.map((r) => r.address) ?? []),
			].filter(Boolean);

			try {
				const thread = await db.emailThread.create({
					data: {
						organizationId: input.organizationId,
						connectionId: input.connectionId,
						externalThreadId: input.externalThreadId,
						subject: input.subject,
						sender: input.senderEmail,
						senderName: input.sender || null,
						participants: JSON.stringify([...new Set(allParticipants)]),
						toRecipients: input.toRecipients ? JSON.stringify(input.toRecipients) : null,
						ccRecipients: input.ccRecipients ? JSON.stringify(input.ccRecipients) : null,
						snippet: input.content.slice(0, 200),
						bodyHtml: input.bodyHtml ?? null,
						bodyText: input.bodyText ?? null,
						messageId: input.messageId ?? null,
						entityId: existingEntityId,
						receivedAt: input.receivedAt,
						processedAt: new Date(),
					},
				});

				if (input.attachments && input.attachments.length > 0) {
					await db.emailAttachment.createMany({
						data: input.attachments.map((att) => ({
							threadId: thread.id,
							filename: att.filename,
							mimeType: att.mimeType ?? null,
							size: att.size ?? null,
							externalId: att.externalId,
							contentId: att.contentId ?? null,
						})),
					});
				}
			} catch (threadError) {
				console.error("[processEmail] Thread append failed:", threadError);
				throw threadError;
			}

			// 更新 Entity updatedAt + summary（追加新摘要）
			await db.flowEntity.update({
				where: { id: existingEntityId },
				data: {
					updatedAt: new Date(),
					...(summary && summary !== input.content.slice(0, 200)
						? { aiSummary: summary }
						: {}),
				},
			});

			await db.timelineEvent.create({
				data: {
					entityId: existingEntityId,
					type: "email_received",
					content: `Follow-up email from ${input.sender}: ${input.subject}`,
					metadata: JSON.stringify({
						sender: input.senderEmail,
						subject: input.subject,
					}),
				},
			});

			return {
				success: true,
				entityId: existingEntityId,
				classification: categorySlug ?? entityType,
				categorySlug,
				requiresManualReview: false,
			};
		}

		// ─── 兜底：创建新 Entity ───

		const validEntityType = (["APPROVAL", "REPORT", "ISSUE", "FEEDBACK"] as const).includes(
			entityType as "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK",
		)
			? (entityType as "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK")
			: "FEEDBACK";

		const initialStatus = determineInitialStatus(
			categorySlug ?? entityType.toLowerCase(),
			extractedFields,
		);

		const entity = await db.flowEntity.create({
			data: {
				organizationId: input.organizationId,
				type: validEntityType,
				categoryId: categoryId ?? undefined,
				title:
					(extractedFields as { title?: string }).title ?? input.subject,
				status: initialStatus,
				extractedFields: JSON.stringify(extractedFields),
				aiSummary: summary,
				aiConfidence: confidence,
				requiresReview,
			},
		});

		const allParticipants = [
			input.senderEmail,
			...(input.toRecipients?.map((r) => r.address) ?? []),
			...(input.ccRecipients?.map((r) => r.address) ?? []),
		].filter(Boolean);

		try {
			const thread = await db.emailThread.create({
				data: {
					organizationId: input.organizationId,
					connectionId: input.connectionId,
					externalThreadId: input.externalThreadId,
					subject: input.subject,
					sender: input.senderEmail,
					senderName: input.sender || null,
					participants: JSON.stringify([...new Set(allParticipants)]),
					toRecipients: input.toRecipients ? JSON.stringify(input.toRecipients) : null,
					ccRecipients: input.ccRecipients ? JSON.stringify(input.ccRecipients) : null,
					snippet: input.content.slice(0, 200),
					bodyHtml: input.bodyHtml ?? null,
					bodyText: input.bodyText ?? null,
					messageId: input.messageId ?? null,
					entityId: entity.id,
					receivedAt: input.receivedAt,
					processedAt: new Date(),
				},
			});

			if (input.attachments && input.attachments.length > 0) {
				await db.emailAttachment.createMany({
					data: input.attachments.map((att) => ({
						threadId: thread.id,
						filename: att.filename,
						mimeType: att.mimeType ?? null,
						size: att.size ?? null,
						externalId: att.externalId,
						contentId: att.contentId ?? null,
					})),
				});
			}
		} catch (threadError) {
			console.error("[processEmail] Thread creation failed:", threadError);
			throw threadError;
		}

		await db.timelineEvent.create({
			data: {
				entityId: entity.id,
				type: "email_received",
				content: `Email received from ${input.sender}: ${input.subject}`,
				metadata: JSON.stringify({
					sender: input.senderEmail,
					subject: input.subject,
				}),
			},
		});

		const classLabel = categorySlug ?? entityType;

		let suggestions: unknown[] = [];
		try {
			suggestions = await generateSuggestions({
				entityType,
				entityStatus: initialStatus,
				extractedFields,
				latestEmailContent: input.content.slice(0, 2000),
				timelineSummary: summary,
				availableTools: [
					"add_timeline_event",
					"approve_entity",
					"reject_entity",
					"update_entity_status",
				],
			});
		} catch {
			// suggestions generation is non-critical
		}

		await db.timelineEvent.create({
			data: {
				entityId: entity.id,
				type: "ai_summary",
				content: `AI classified as ${classLabel} (${Math.round(confidence * 100)}% confidence): ${summary}`,
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

		// ─── Memory: record contact profile + classification learning ───
		memoryManager
			.recordContactProfile({
				organizationId: input.organizationId,
				contactEmail: input.senderEmail,
				content: `${input.sender} (${input.senderEmail}) 发送了 ${categorySlug ?? entityType} 类型邮件: "${input.subject}"`,
				metadata: {
					senderName: input.sender,
					lastEmailType: categorySlug ?? entityType,
					lastSubject: input.subject,
					entityId: entity.id,
				},
			})
			.catch(() => {});

		return {
			success: true,
			entityId: entity.id,
			classification: entityType,
			categorySlug,
			requiresManualReview: requiresReview,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
			requiresManualReview: true,
		};
	}
}

function determineInitialStatus(
	slug: string,
	extractedFields: Record<string, unknown>,
): string {
	switch (slug) {
		case "approval":
			return "pending";
		case "report": {
			const overallStatus = (
				extractedFields as { overallStatus?: string }
			).overallStatus;
			if (overallStatus === "blocked") {
				return "blocked";
			}
			return "in_progress";
		}
		case "issue":
			return "open";
		case "feedback":
			return "received";
		default:
			return "pending";
	}
}
