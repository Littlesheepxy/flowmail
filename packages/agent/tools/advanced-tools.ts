import { tool, generateText, textModel } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";

/**
 * Web Search 工具 — 受前端开关控制，仅在 webSearchEnabled=true 时注册
 */
export function createWebSearchTool() {
	return {
		web_search: tool({
			description:
				"搜索互联网获取实时信息。当用户询问公司背景、政策法规、行业数据、人员信息、或需要验证邮件中提到的外部事实时调用。",
			inputSchema: z.object({
				query: z.string().describe("搜索关键词"),
				context: z
					.string()
					.optional()
					.describe("搜索背景说明，帮助优化搜索结果"),
			}),
			execute: async (input: { query: string; context?: string }) => {
				const searchQuery = input.context
					? `${input.query} (${input.context})`
					: input.query;

				try {
					const res = await fetch(
						`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=5`,
						{
							headers: {
								Accept: "application/json",
								"Accept-Encoding": "gzip",
								"X-Subscription-Token":
									process.env.BRAVE_SEARCH_API_KEY ?? "",
							},
						},
					);

					if (!res.ok) {
						if (!process.env.BRAVE_SEARCH_API_KEY) {
							const { output } = await generateText({
								model: textModel,
								prompt: `请根据你的知识回答以下问题（注意：这不是实时搜索结果，可能不是最新信息）：\n\n${searchQuery}`,
							});
							return {
								source: "ai_knowledge",
								disclaimer:
									"此结果基于 AI 知识库，非实时搜索，信息可能不是最新的。",
								summary: output ?? "(无结果)",
								results: [],
							};
						}
						return { error: `搜索失败：HTTP ${res.status}` };
					}

					const data = (await res.json()) as {
						web?: {
							results?: Array<{
								title: string;
								url: string;
								description: string;
							}>;
						};
					};
					const results = (data.web?.results ?? []).slice(0, 5);

					const summaryPrompt = results
						.map(
							(r, i) =>
								`[${i + 1}] ${r.title}\n${r.description}\n${r.url}`,
						)
						.join("\n\n");

					const { output: summary } = await generateText({
						model: textModel,
						prompt: `根据以下搜索结果，用简体中文简洁总结与"${input.query}"相关的关键信息：\n\n${summaryPrompt}`,
					});

					return {
						source: "web_search",
						query: input.query,
						summary: summary ?? "(无法生成摘要)",
						results: results.map((r) => ({
							title: r.title,
							url: r.url,
							snippet: r.description,
						})),
					};
				} catch (err) {
					return {
						error: `搜索出错：${err instanceof Error ? err.message : "Unknown"}`,
					};
				}
			},
		}),
	};
}

/**
 * 线程摘要工具 — 即时重新读取事项全部邮件内容生成综合摘要
 */
export function createSummarizeThreadTool() {
	return {
		summarize_thread: tool({
			description:
				"综合摘要事项关联的全部邮件内容。当用户说'帮我总结'、'这件事到底怎么回事'、'来龙去脉'时调用。与 get_entity 不同：此工具会重新读取所有邮件原文并生成全新摘要。",
			inputSchema: z.object({
				entityId: z.string().describe("Entity ID"),
			}),
			execute: async (input: { entityId: string }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: input.entityId },
					include: {
						threads: {
							select: {
								subject: true,
								sender: true,
								senderName: true,
								bodyText: true,
								receivedAt: true,
							},
							orderBy: { receivedAt: "asc" },
						},
						timeline: {
							where: { type: "status_changed" },
							select: { content: true, createdAt: true },
							orderBy: { createdAt: "asc" },
						},
					},
				});
				if (!entity) {
					return { error: "事项不存在" };
				}
				if (entity.threads.length === 0) {
					return { error: "无关联邮件" };
				}

				const threadText = entity.threads
					.map(
						(t, i) =>
							`--- 邮件 ${i + 1} (${t.senderName ?? t.sender}, ${t.receivedAt.toISOString()}) ---\n主题：${t.subject}\n\n${(t.bodyText ?? "").slice(0, 3000)}`,
					)
					.join("\n\n");

				const statusHistory = entity.timeline
					.map(
						(e) =>
							`[${e.createdAt.toISOString()}] ${e.content}`,
					)
					.join("\n");

				const { output: summary } = await generateText({
					model: textModel,
					prompt: `请用简体中文为以下事项生成一份结构化摘要，包含：
1. **核心诉求**：这件事的本质是什么
2. **关键参与者**：谁在推动、谁需要决策
3. **时间线**：事项的演进过程
4. **当前状态**：现在到哪一步了
5. **待办事项**：接下来需要做什么

事项标题：${entity.title}（类型：${entity.type}，状态：${entity.status}）

邮件内容（${entity.threads.length} 封）：
${threadText}

状态变更历史：
${statusHistory || "（无）"}`,
				});

				return {
					entityId: input.entityId,
					title: entity.title,
					emailCount: entity.threads.length,
					summary: summary ?? "(生成失败)",
				};
			},
		}),
	};
}

/**
 * 多事项对比工具
 */
export function createCompareEntitiesTool() {
	return {
		compare_entities: tool({
			description:
				"对比两个或多个事项的异同。当用户说'这两个有什么区别'、'对比一下'、'和上次比怎么样'时调用。",
			inputSchema: z.object({
				entityIds: z
					.array(z.string())
					.min(2)
					.max(5)
					.describe("要对比的事项 ID 列表（2-5 个）"),
				focusAreas: z
					.array(z.string())
					.optional()
					.describe("重点对比的方面，如['金额', '时间', '审批人']"),
			}),
			execute: async (input: {
				entityIds: string[];
				focusAreas?: string[];
			}) => {
				const entities = await db.flowEntity.findMany({
					where: { id: { in: input.entityIds } },
					include: {
						threads: {
							select: {
								subject: true,
								sender: true,
								bodyText: true,
							},
							take: 1,
							orderBy: { receivedAt: "desc" },
						},
					},
				});

				if (entities.length < 2) {
					return { error: "至少需要找到 2 个事项进行对比" };
				}

				const entitiesText = entities
					.map((e) => {
						const fields = e.extractedFields
							? JSON.parse(e.extractedFields)
							: {};
						return `## ${e.title}
- 类型：${e.type}，状态：${e.status}
- AI 摘要：${e.aiSummary ?? "无"}
- 结构化字段：${JSON.stringify(fields)}
- 最新邮件发件人：${e.threads[0]?.sender ?? "无"}
- 邮件摘要：${(e.threads[0]?.bodyText ?? "").slice(0, 1000)}`;
					})
					.join("\n\n");

				const focusHint = input.focusAreas?.length
					? `\n重点对比：${input.focusAreas.join("、")}`
					: "";

				const { output: comparison } = await generateText({
					model: textModel,
					prompt: `请用简体中文对比以下 ${entities.length} 个事项，生成结构化对比分析：${focusHint}

${entitiesText}

输出格式：
1. **相同点**
2. **不同点**（用表格或列表对比关键字段）
3. **建议**（基于对比结果给出行动建议）`,
				});

				return {
					comparedCount: entities.length,
					entities: entities.map((e) => ({
						id: e.id,
						title: e.title,
						type: e.type,
						status: e.status,
					})),
					comparison: comparison ?? "(生成失败)",
				};
			},
		}),
	};
}

/**
 * 创建提醒工具 — 使用 timeline event 存储
 */
export function createReminderTool() {
	return {
		create_reminder: tool({
			description:
				"为事项创建定时提醒。当用户说'提醒我'、'X天后跟进'、'到期前通知我'时调用。提醒会记录在事项时间线中。",
			inputSchema: z.object({
				entityId: z.string().describe("关联事项 ID"),
				message: z.string().describe("提醒内容"),
				remindAt: z
					.string()
					.describe(
						"提醒时间，ISO 8601 格式。例如 '2026-04-15T09:00:00+08:00'",
					),
				priority: z
					.enum(["low", "normal", "urgent"])
					.default("normal")
					.describe("提醒优先级"),
			}),
			execute: async (input: {
				entityId: string;
				message: string;
				remindAt: string;
				priority: string;
			}) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: input.entityId },
					select: { id: true, title: true, organizationId: true },
				});
				if (!entity) {
					return { error: "事项不存在" };
				}

				const remindDate = new Date(input.remindAt);
				if (Number.isNaN(remindDate.getTime())) {
					return { error: "提醒时间格式无效" };
				}

				const now = new Date();
				if (remindDate <= now) {
					return { error: "提醒时间必须在未来" };
				}

				const diffMs = remindDate.getTime() - now.getTime();
				const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
				const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

				const timeLabel =
					diffDays > 1 ? `${diffDays} 天后` : `${diffHours} 小时后`;

				await db.timelineEvent.create({
					data: {
						entityId: input.entityId,
						type: "reminder_set",
						content: `⏰ 提醒已设置（${timeLabel}）：${input.message}`,
						metadata: JSON.stringify({
							remindAt: input.remindAt,
							priority: input.priority,
							status: "pending",
						}),
					},
				});

				return {
					success: true,
					entityId: input.entityId,
					entityTitle: entity.title,
					message: input.message,
					remindAt: input.remindAt,
					timeLabel,
					priority: input.priority,
				};
			},
		}),
	};
}
