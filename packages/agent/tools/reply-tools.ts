import { tool, generateText, getReplyDraftModel, textModel } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";
import { MemoryManager } from "../memory/manager";
import { MEMORY_CATEGORIES, MEMORY_SCOPES } from "../core/types";

const memoryManager = new MemoryManager();

export function createReplyTools() {
	return {
		draft_reply: tool({
			description: `起草邮件回复。使用 GPT 模型生成高质量的邮件回复草稿。
用户说【帮我回复这封邮件】【怎么回复比较好】【帮我写个回复】【草拟回复】时调用。
输出包含可直接复制的回复正文，用户可以复制后粘贴到邮箱客户端发送。
支持指定语言、语气、回复要点。会自动参考用户的写作风格和联系人记忆。`,
			inputSchema: z.object({
				entityId: z.string().optional().describe("事项 ID，从中获取邮件上下文"),
				threadId: z.string().optional().describe("邮件线程 ID"),
				organizationId: z.string().optional().describe("组织 ID，用于检索记忆"),
				instructions: z.string().optional().describe("用户对回复的具体要求，如'同意他的方案'、'婉拒'、'请他提供更多细节'"),
				tone: z.enum(["formal", "friendly", "concise", "detailed"]).optional().describe("语气风格"),
				language: z.enum(["zh", "en", "auto"]).optional().describe("回复语言，auto 则跟随原邮件语言"),
				includeGreeting: z.boolean().optional().describe("是否包含称呼和落款，默认 true"),
			}),
			execute: async (input: {
				entityId?: string;
				threadId?: string;
				organizationId?: string;
				instructions?: string;
				tone?: "formal" | "friendly" | "concise" | "detailed";
				language?: "zh" | "en" | "auto";
				includeGreeting?: boolean;
			}) => {
				let threadIds: string[] = input.threadId ? [input.threadId] : [];
				let organizationId = input.organizationId;

				if (input.entityId && !input.threadId) {
					const entity = await db.flowEntity.findUnique({
						where: { id: input.entityId },
						select: { organizationId: true },
					});
					if (entity) {
						organizationId = organizationId || entity.organizationId;
					}
					const threads = await db.emailThread.findMany({
						where: { entityId: input.entityId },
						select: { id: true },
						orderBy: { receivedAt: "desc" },
					});
					threadIds = threads.map((t) => t.id);
				}

				if (threadIds.length === 0) {
					return { error: "未找到邮件线程，无法起草回复" };
				}

				const threads = await db.emailThread.findMany({
					where: { id: { in: threadIds } },
					select: {
						subject: true,
						sender: true,
						senderName: true,
						bodyText: true,
						snippet: true,
						receivedAt: true,
						toRecipients: true,
						ccRecipients: true,
					},
					orderBy: { receivedAt: "desc" },
					take: 3,
				});

				if (threads.length === 0) {
					return { error: "邮件内容为空" };
				}

				const latest = threads[0];
				const senderName = latest.senderName || latest.sender.split("@")[0];

				let styleContext = "";
				let contactContext = "";

			if (organizationId) {
					const selfObjects = await memoryManager.listObjects(organizationId, "self");
					const selfObject = selfObjects[0];
					if (selfObject) {
						const attrs = selfObject.attributes as Record<string, string>;
						const parts: string[] = [];
						if (attrs.writing_style) {
							parts.push(`风格总结：${attrs.writing_style}`);
						}
						if (attrs.sample_emails) {
							parts.push(`参照邮件：\n${attrs.sample_emails}`);
						}
						if (attrs.reply_patterns) {
							parts.push(`回复模式：\n${attrs.reply_patterns}`);
						}
						if (attrs.signature) {
							parts.push(`署名：${attrs.signature}`);
						}
						if (parts.length > 0) {
							styleContext = `\n--- 用户写作风格参考 ---\n${parts.join("\n\n")}`;
						}
					}

					if (!styleContext) {
						const styleMemories = await memoryManager.recall({
							organizationId,
							categories: [MEMORY_CATEGORIES.user_preference],
							query: "写作风格 回复 邮件",
							limit: 5,
						});
						if (styleMemories.length > 0) {
							styleContext = `\n--- 用户写作风格参考 ---\n${styleMemories.map((m) => `- ${m.content}`).join("\n")}`;
						}
					}

					const contactObject = await memoryManager.getObject(organizationId, "person", latest.sender);
					if (contactObject) {
						const attrs = contactObject.attributes as Record<string, string>;
						const parts: string[] = [];
						if (attrs.role) {
							parts.push(`职务：${attrs.role}`);
						}
						if (attrs.company) {
							parts.push(`公司：${attrs.company}`);
						}
						if (attrs.communication_style) {
							parts.push(`沟通风格：${attrs.communication_style}`);
						}
						if (attrs.sample_interactions) {
							parts.push(`典型对话：\n${attrs.sample_interactions}`);
						}
						if (attrs.sensitivity) {
							parts.push(`敏感点：${attrs.sensitivity}`);
						}
						if (parts.length > 0) {
							contactContext = `\n--- 收件人画像（${senderName}）---\n${parts.join("\n")}`;
						}
					}

					if (!contactContext) {
						const contactMemories = await memoryManager.recall({
							organizationId,
							categories: [MEMORY_CATEGORIES.contact_profile],
							scope: { type: MEMORY_SCOPES.contact, id: latest.sender },
							limit: 5,
						});
						if (contactMemories.length > 0) {
							contactContext = `\n--- 收件人画像（${senderName}）---\n${contactMemories.map((m) => `- ${m.content}`).join("\n")}`;
						}
					}
				}

				const toneMap = {
					formal: "正式、专业",
					friendly: "友好、亲切",
					concise: "简洁、直接",
					detailed: "详细、周全",
				};

				const toneDesc = input.tone ? toneMap[input.tone] : "专业且友好";
				const langDesc = input.language === "zh" ? "中文"
					: input.language === "en" ? "English"
					: "与原邮件相同的语言";
				const includeGreeting = input.includeGreeting !== false;

				const contextEmails = threads.map((t, i) => {
					const body = (t.bodyText || t.snippet || "").slice(0, 1500);
					return `--- 邮件 ${i + 1} ---\n发件人: ${t.senderName || t.sender}\n主题: ${t.subject}\n时间: ${t.receivedAt.toISOString()}\n内容:\n${body}`;
				}).join("\n\n");

				const prompt = `你是一位专业的邮件回复助手。请根据以下邮件内容起草回复。
${styleContext}${contactContext}

${contextEmails}

--- 回复要求 ---
${input.instructions ? `用户具体要求：${input.instructions}` : "根据邮件内容生成合适的回复"}
语气：${toneDesc}
语言：${langDesc}
${includeGreeting ? `包含对 ${senderName} 的称呼和落款` : "不需要称呼和落款，只写正文"}
${styleContext ? "请严格模仿上方「参照邮件」中的用词、句式和语气来撰写回复。如有「回复模式」，按照对应场景的模式组织回复结构。" : ""}
${contactContext ? "请参考上方的收件人画像。如有「典型对话」样本，注意收件人的沟通习惯和敏感点，据此调整回复策略。" : ""}

请直接输出回复邮件的正文，不要加任何解释、标注或引号。回复应该自然、得体、切中要点。`;

				try {
					const model = getReplyDraftModel();
					const result = await generateText({
						model,
						prompt,
					});

					const replyText = result.text.trim();

					return {
						draft: replyText,
						replyTo: latest.sender,
						replyToName: senderName,
						subject: latest.subject.startsWith("Re:") ? latest.subject : `Re: ${latest.subject}`,
						tone: input.tone || "professional",
						language: input.language || "auto",
						model: process.env.AI_REPLY_MODEL || "gpt-5.4",
						usedStyleMemory: styleContext.length > 0,
						usedContactMemory: contactContext.length > 0,
						hint: "用户可以直接复制上方草稿，粘贴到邮箱客户端发送。也可以要求修改。",
					};
				} catch (err) {
					return {
						error: "回复起草失败",
						message: err instanceof Error ? err.message : String(err),
					};
				}
			},
		}),

		learn_reply_style: tool({
			description: `分析用户的邮件发送历史，学习并记忆用户的写作风格。
用户说【学习我的写作风格】【记住我的回复习惯】【分析我的邮件风格】时调用。
会从用户已发送的邮件中提取写作特征，写入记忆系统。`,
			inputSchema: z.object({
				organizationId: z.string().describe("组织 ID"),
				userEmail: z.string().describe("用户的邮箱地址"),
				sampleCount: z.number().optional().describe("分析的邮件样本数量，默认 10"),
			}),
			execute: async (input: {
				organizationId: string;
				userEmail: string;
				sampleCount?: number;
			}) => {
				const sampleCount = input.sampleCount ?? 10;

				const sentEmails = await db.emailThread.findMany({
					where: {
						sender: input.userEmail,
						entity: { organizationId: input.organizationId },
						bodyText: { not: null },
					},
					select: {
						subject: true,
						bodyText: true,
						receivedAt: true,
					},
					orderBy: { receivedAt: "desc" },
					take: sampleCount,
				});

				if (sentEmails.length < 2) {
					return {
						success: false,
						error: "发送记录不足，至少需要 2 封邮件才能分析风格",
						samplesFound: sentEmails.length,
					};
				}

				const emailSamples = sentEmails.map((e, i) => {
					const body = (e.bodyText ?? "").slice(0, 800);
					return `--- 样本 ${i + 1} ---\n主题: ${e.subject}\n${body}`;
				}).join("\n\n");

				const analysisPrompt = `请分析以下邮件样本，总结发件人的写作风格特征。输出 3 个部分，用 ===SECTION=== 分隔。

${emailSamples}

=== 第一部分：writing_style ===
从以下维度总结风格（纯文本，每个维度一行）：
- 语言偏好（中文/英文/混合）
- 语气风格（正式/友好/简洁/其他）
- 常用开头和结尾方式
- 用词特点
- 段落结构偏好
- 署名习惯

=== 第二部分：sample_emails ===
从样本中挑选 2-3 封最能代表风格的典型邮件，按场景分类引用原文片段。格式示例：
📧 审批回复（同意）：
"Hi 张伟，采购申请已审批通过..."

📧 汇报回复：
"收到，进展符合预期。两个关注点..."

=== 第三部分：reply_patterns ===
总结不同场景的回复模式（同意类/拒绝类/催促类/信息确认类），每种模式一行：
同意类：直接给结论 + 一句行动指引
拒绝/待定类：先说结论，再说原因和下一步

请严格按 ===SECTION=== 分隔三部分输出。`;

				try {
					const model = textModel;
					const result = await generateText({
						model,
						prompt: analysisPrompt,
					});

					const styleAnalysis = result.text.trim();

					const sections = styleAnalysis.split(/===SECTION===/);
					const writingStyle = (sections[0] ?? styleAnalysis).trim();
					const sampleEmails = (sections[1] ?? "").trim();
					const replyPatterns = (sections[2] ?? "").trim();

					await memoryManager.write({
						organizationId: input.organizationId,
						category: MEMORY_CATEGORIES.user_preference,
						scope: MEMORY_SCOPES.user,
						scopeId: input.userEmail,
						content: `用户邮件写作风格:\n${writingStyle}`,
						metadata: {
							type: "reply_style",
							userEmail: input.userEmail,
							samplesAnalyzed: sentEmails.length,
							analyzedAt: new Date().toISOString(),
						},
						importance: 8,
					});

					const selfObjectId = input.userEmail;
					const updates: Record<string, string> = { writing_style: writingStyle };
					if (sampleEmails) {
						updates.sample_emails = sampleEmails;
					}
					if (replyPatterns) {
						updates.reply_patterns = replyPatterns;
					}

					await memoryManager.upsertObject({
						organizationId: input.organizationId,
						objectType: "self",
						objectId: selfObjectId,
						name: "我的画像",
						updates,
					});

					return {
						success: true,
						styleAnalysis: writingStyle,
						sampleEmails: sampleEmails || undefined,
						replyPatterns: replyPatterns || undefined,
						samplesAnalyzed: sentEmails.length,
						hint: "写作风格、参照邮件和回复模式已记录到记忆对象。下次使用 draft_reply 时会自动参考。",
					};
				} catch (err) {
					return {
						success: false,
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},
		}),
	};
}
