import { tool, Output, generateText, textModel, fastModel } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";

export function createAnalysisTools() {
	return {
		predict_risk: tool({
			description:
				"AI 风险预测。当用户询问风险、截止日期、是否能按时完成时调用。",
			inputSchema: z.object({
				entityId: z.string(),
			}),
			execute: async (input: { entityId: string }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: input.entityId },
					include: { timeline: { orderBy: { createdAt: "asc" } } },
				});
				if (!entity) {
					return { error: "Not found" };
				}
				if (
					!process.env.AI_GATEWAY_API_KEY &&
					!process.env.OPENAI_API_KEY
				) {
					return { riskLevel: "unknown", message: "AI key not configured" };
				}

				const fields = entity.extractedFields
					? JSON.parse(entity.extractedFields)
					: {};
				const timelineText = entity.timeline
					.map(
						(e) =>
							`[${e.createdAt.toISOString()}] ${e.type}: ${e.content}`,
					)
					.join("\n");

				const { output: object } = await generateText({
					model: textModel,
					output: Output.object({
						schema: z.object({
							riskLevel: z.enum(["low", "medium", "high", "critical"]),
							riskFactors: z.array(z.string()),
							predictedOutcome: z.string(),
							suggestedActions: z.array(z.string()),
							deadlineRisk: z.object({
								hasDeadline: z.boolean(),
								deadline: z.string().nullable(),
								daysRemaining: z.number().nullable(),
								isAtRisk: z.boolean(),
							}),
							confidence: z.number().min(0).max(1),
						}),
					}),
					prompt: `请用简体中文分析以下事项的风险。所有文本字段（riskFactors, predictedOutcome, suggestedActions）必须使用中文。

事项："${entity.title}"（类型：${entity.type}，状态：${entity.status}）
字段：${JSON.stringify(fields)}
时间线：${timelineText || "（无）"}
今天：${new Date().toISOString().split("T")[0]}

请评估风险等级、风险因素、预测结果、建议操作和截止日期风险。`,
				});

				return { ...object, entityId: input.entityId };
			},
		}),

		get_timeline_diff: tool({
			description:
				"获取事项时间线的语义变化分析。当用户问发生了什么变化、进展如何时调用。",
			inputSchema: z.object({
				entityId: z.string(),
			}),
			execute: async (input: { entityId: string }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: input.entityId },
					select: { id: true, type: true, title: true },
				});
				if (!entity) {
					return { error: "Not found" };
				}

				const events = await db.timelineEvent.findMany({
					where: { entityId: input.entityId },
					orderBy: { createdAt: "asc" },
				});
				if (events.length < 2) {
					return {
						summary: "Not enough events for diff",
						changes: [],
					};
				}

				const eventsText = events
					.map(
						(e) =>
							`[${e.createdAt.toISOString()}] ${e.type}: ${e.content}`,
					)
					.join("\n");

				const { output: object } = await generateText({
					model: textModel,
					output: Output.object({
						schema: z.object({
							summary: z.string(),
							changes: z.array(
								z.object({
									field: z.string(),
									before: z.string().nullable(),
									after: z.string().nullable(),
									significance: z.enum([
										"low",
										"medium",
										"high",
										"critical",
									]),
								}),
							),
							riskSignals: z.array(z.string()),
							progressDelta: z.number().nullable(),
							recommendation: z.string().nullable(),
						}),
					}),
					prompt: `请用简体中文分析以下事项的时间线变化。所有文本字段必须使用中文。

事项："${entity.title}"（类型：${entity.type}）
事件：
${eventsText}

分析：发生了什么变化？有哪些风险信号？进展变化量（-100到100）？有什么建议？`,
				});

				return { ...object, entityId: input.entityId };
			},
		}),

		batch_reclassify: tool({
			description:
				"批量重新分类：AI 自动检查组织内所有事项的分类是否准确，列出建议修改的事项。",
			inputSchema: z.object({
				organizationId: z.string(),
			}),
			execute: async (input: { organizationId: string }) => {
				const entities = await db.flowEntity.findMany({
					where: { organizationId: input.organizationId },
					select: {
						id: true,
						title: true,
						type: true,
						status: true,
						aiSummary: true,
						aiConfidence: true,
					},
					orderBy: { updatedAt: "desc" },
					take: 30,
				});

				const lowConfidence = entities.filter(
					(e) => e.aiConfidence != null && e.aiConfidence < 0.7,
				);
				const byType: Record<string, number> = {};
				for (const e of entities) {
					byType[e.type] = (byType[e.type] ?? 0) + 1;
				}

				if (
					!process.env.AI_GATEWAY_API_KEY &&
					!process.env.OPENAI_API_KEY
				) {
					return {
						total: entities.length,
						byType,
						lowConfidenceCount: lowConfidence.length,
						suggestions: lowConfidence.map((e) => ({
							id: e.id,
							title: e.title,
							currentType: e.type,
							confidence: e.aiConfidence,
							reason: "AI 置信度低于 70%",
						})),
					};
				}

				const itemsText = lowConfidence
					.map(
						(e) =>
							`- "${e.title}" (当前: ${e.type}, 置信度: ${Math.round((e.aiConfidence ?? 0) * 100)}%, 摘要: ${e.aiSummary ?? "无"})`,
					)
					.join("\n");

				const { output: object } = await generateText({
					model: fastModel,
					output: Output.object({
						schema: z.object({
							suggestions: z.array(
								z.object({
									entityId: z.string(),
									title: z.string(),
									currentType: z.string(),
									suggestedType: z
										.enum([
											"APPROVAL",
											"REPORT",
											"ISSUE",
											"FEEDBACK",
										])
										.nullable(),
									confidence: z.number(),
									reason: z.string(),
								}),
							),
						}),
					}),
					prompt: `请用简体中文分析以下事项的分类是否正确。对于分类可能有误的，给出建议的新分类和原因。
如果分类正确，suggestedType 设为 null。

事项列表：
${itemsText || "（无低置信度事项）"}

可用分类：APPROVAL（审批）、REPORT（汇报）、ISSUE（问题）、FEEDBACK（反馈）`,
				});

				return {
					total: entities.length,
					byType,
					lowConfidenceCount: lowConfidence.length,
					suggestions: object.suggestions,
				};
			},
		}),
	};
}
