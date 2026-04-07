import { tool } from "@repo/ai";
import { db, decryptEmailContent } from "@repo/database";
import { z } from "zod";

export function createClassificationTools(deps: {
	processEmail: (params: Record<string, unknown>) => Promise<{
		success: boolean;
		entityId?: string;
		classification?: string;
		categorySlug?: string;
	}>;
}) {
	return {
		scan_email_headers: tool({
			description:
				"快速扫描未分类邮件的标题、发件人和时间。用于智能分类流程的第一步——了解邮件全貌。",
			inputSchema: z.object({
				organizationId: z.string(),
				limit: z.number().default(100).describe("扫描邮件数量上限"),
			}),
			execute: async (input: {
				organizationId: string;
				limit: number;
			}) => {
				const total = await db.emailThread.count({
					where: {
						organizationId: input.organizationId,
						entityId: null,
					},
				});

				const threads = await db.emailThread.findMany({
					where: {
						organizationId: input.organizationId,
						entityId: null,
					},
					select: {
						id: true,
						subject: true,
						sender: true,
						senderName: true,
						receivedAt: true,
					},
					orderBy: { receivedAt: "desc" },
					take: input.limit,
				});

				const senderFreq: Record<string, number> = {};
				for (const t of threads) {
					const key = t.sender ?? "unknown";
					senderFreq[key] = (senderFreq[key] ?? 0) + 1;
				}

				const sortedSenders = Object.entries(senderFreq)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 15)
					.map(([email, count]) => ({ email, count }));

				return {
					totalUnclassified: total,
					scannedCount: threads.length,
					emails: threads.map((t) => ({
						id: t.id,
						subject: t.subject,
						sender: t.senderName ?? t.sender,
						senderEmail: t.sender,
						receivedAt: t.receivedAt.toISOString(),
					})),
					topSenders: sortedSenders,
				};
			},
		}),

		read_email_samples: tool({
			description:
				"精读选定邮件的正文片段（前500字）。用于智能分类流程的第二步——深入理解邮件内容和业务意图。",
			inputSchema: z.object({
				organizationId: z.string(),
				emailIds: z
					.array(z.string())
					.max(20)
					.describe(
						"从 scan_email_headers 结果中选取的代表性邮件 ID",
					),
			}),
			execute: async (input: {
				organizationId: string;
				emailIds: string[];
			}) => {
				const threads = await db.emailThread.findMany({
					where: {
						id: { in: input.emailIds },
						organizationId: input.organizationId,
					},
					select: {
						id: true,
						subject: true,
						sender: true,
						senderName: true,
						snippet: true,
						bodyText: true,
						receivedAt: true,
					},
				});

				return {
					count: threads.length,
					emails: threads.map((t) => {
						const decrypted = decryptEmailContent(t);
						const body = decrypted.bodyText ?? t.snippet ?? "";
						return {
							id: t.id,
							subject: t.subject,
							sender: t.senderName ?? t.sender,
							senderEmail: t.sender,
							bodyPreview: body.slice(0, 500),
							receivedAt: t.receivedAt.toISOString(),
						};
					}),
				};
			},
		}),

		read_email_detail: tool({
			description:
				"读取单封邮件的完整正文。当对分类有分歧或需要确认某封邮件的具体内容时按需调用。",
			inputSchema: z.object({
				organizationId: z.string(),
				emailId: z.string(),
			}),
			execute: async (input: {
				organizationId: string;
				emailId: string;
			}) => {
				const thread = await db.emailThread.findFirst({
					where: {
						id: input.emailId,
						organizationId: input.organizationId,
					},
					select: {
						id: true,
						subject: true,
						sender: true,
						senderName: true,
						bodyText: true,
						snippet: true,
						receivedAt: true,
						participants: true,
					},
				});

				if (!thread) {
					return { error: "邮件未找到或无权访问" };
				}

				const decrypted = decryptEmailContent(thread);
				const body = decrypted.bodyText ?? thread.snippet ?? "";
				return {
					id: thread.id,
					subject: thread.subject,
					sender: thread.senderName ?? thread.sender,
					senderEmail: thread.sender,
					bodyText: body.slice(0, 2000),
					participants: thread.participants,
					receivedAt: thread.receivedAt.toISOString(),
				};
			},
		}),

		setup_categories: tool({
			description:
				"根据用户确认的分类方案批量创建分类。必须在用户明确确认后才能调用。aiPrompt 的质量决定分类准确度。",
			inputSchema: z.object({
				organizationId: z.string(),
				categories: z.array(
					z.object({
						name: z.string().describe("分类名称，如「需求评审」"),
						slug: z
							.string()
							.regex(/^[a-z0-9-]+$/)
							.describe("英文标识符，如 requirement-review"),
						color: z
							.string()
							.regex(/^#[0-9a-fA-F]{6}$/)
							.describe("颜色代码"),
						aiPrompt: z
							.string()
							.describe(
								"给分类器的特征描述：什么样的邮件属于这一类，包含关键词、发件人特征、格式特征",
							),
					}),
				),
				replaceDefaults: z
					.boolean()
					.default(true)
					.describe("是否替换默认的4个分类"),
			}),
			execute: async (input: {
				organizationId: string;
				categories: Array<{
					name: string;
					slug: string;
					color: string;
					aiPrompt: string;
				}>;
				replaceDefaults: boolean;
			}) => {
				if (input.replaceDefaults) {
					await db.category.deleteMany({
						where: {
							organizationId: input.organizationId,
							isDefault: true,
						},
					});
				}

				const maxOrder = await db.category.aggregate({
					where: { organizationId: input.organizationId },
					_max: { sortOrder: true },
				});
				let nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

				const created = [];
				for (const cat of input.categories) {
					const existing = await db.category.findUnique({
						where: {
							organizationId_slug: {
								organizationId: input.organizationId,
								slug: cat.slug,
							},
						},
					});
					if (existing) {
						await db.category.update({
							where: { id: existing.id },
							data: {
								name: cat.name,
								color: cat.color,
								aiPrompt: cat.aiPrompt,
							},
						});
						created.push({
							id: existing.id,
							...cat,
							updated: true,
						});
					} else {
						const record = await db.category.create({
							data: {
								organizationId: input.organizationId,
								name: cat.name,
								slug: cat.slug,
								color: cat.color,
								aiPrompt: cat.aiPrompt,
								sortOrder: nextOrder++,
								isDefault: false,
							},
						});
						created.push({ id: record.id, ...cat, updated: false });
					}
				}

				return {
					created: created.filter((c) => !c.updated).length,
					updated: created.filter((c) => c.updated).length,
					categories: created.map((c) => ({
						id: c.id,
						name: c.name,
						slug: c.slug,
					})),
				};
			},
		}),

		classify_emails_batch: tool({
			description:
				"批量分类未处理的邮件。每次最多处理 50 封，返回进度和分类分布。需要先 setup_categories 再调用。",
			inputSchema: z.object({
				organizationId: z.string(),
				limit: z.number().default(50).describe("本批次处理数量"),
			}),
			execute: async (input: {
				organizationId: string;
				limit: number;
			}) => {
				const remaining = await db.emailThread.count({
					where: {
						organizationId: input.organizationId,
						entityId: null,
					},
				});

				const threads = await db.emailThread.findMany({
					where: {
						organizationId: input.organizationId,
						entityId: null,
					},
					orderBy: { receivedAt: "asc" },
					take: input.limit,
				});

				let processed = 0;
				let errors = 0;
				const byCategory: Record<string, number> = {};

				for (const thread of threads) {
					try {
						const decryptedThread = decryptEmailContent(thread);
						const result = await deps.processEmail({
							threadId: thread.externalThreadId ?? thread.id,
							subject: thread.subject,
							sender: thread.sender,
							senderEmail: thread.sender,
							content:
								decryptedThread.bodyText ??
								thread.snippet ??
								"",
							bodyHtml: decryptedThread.bodyHtml,
							bodyText: decryptedThread.bodyText,
							toRecipients: thread.participants,
							ccRecipients: [],
							attachments: [],
							organizationId: input.organizationId,
							connectionId: thread.connectionId,
							externalThreadId: thread.externalThreadId,
							receivedAt: thread.receivedAt,
							messageId: thread.messageId,
						});
						if (result.success) {
							processed++;
							const cat =
								result.categorySlug ??
								result.classification ??
								"unknown";
							byCategory[cat] = (byCategory[cat] ?? 0) + 1;
						} else {
							errors++;
						}
					} catch {
						errors++;
					}
				}

				const newRemaining = remaining - processed;

				return {
					processed,
					errors,
					remaining: Math.max(0, newRemaining),
					total: remaining,
					byCategory,
					done: newRemaining <= 0,
				};
			},
		}),
	};
}
