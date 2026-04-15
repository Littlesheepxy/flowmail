import { triggerNotification, checkRateLimit, getClientIp, RATE_LIMITS } from "@repo/api";
import { auth } from "@repo/auth";
import { db, getOrganizationMembership } from "@repo/database";
import {
	convertToModelMessages,
	textModel,
	ToolLoopAgent,
	stepCountIs,
	type UIMessage,
	type ToolSet,
} from "@repo/ai";
import {
	getConnector,
	processEmailRaw,
	classifyEmailWithMemory,
	extractApprovalFields,
	extractReportFields,
	summarizeThread,
	enrichEntityById,
	classifyEntityOnly,
} from "@repo/email-processor";
import {
	ToolRegistry,
	MemoryManager,
	buildAgentConfig,
	createEntityTools,
	createAnalysisTools,
	createEmailTools,
	createInboxTools,
	createAttachmentTools,
	createWebSearchTool,
	createSummarizeThreadTool,
	createCompareEntitiesTool,
	createReminderTool,
	createSandboxTools,
	createReplyTools,
	createMemoryTools,
	type PageContext,
} from "@repo/agent";

export const maxDuration = 60;

const memoryManager = new MemoryManager();

function createAgentToolRegistry(options?: { webSearchEnabled?: boolean }) {
	const registry = new ToolRegistry();

	const notify = (p: { organizationId: string; type: string; entityId: string; title: string; body: string }) =>
		triggerNotification({
			organizationId: p.organizationId,
			type: p.type as Parameters<typeof triggerNotification>[0]["type"],
			entityId: p.entityId,
			title: p.title,
			body: p.body,
		});

	registry.registerBuiltin(
		createEntityTools({
			triggerNotification: notify,
			enrichEntityById,
			reEnrich: async (entityId: string) => {
				try {
					const entity = await db.flowEntity.findUnique({
						where: { id: entityId },
						include: {
							threads: {
								select: { bodyText: true, subject: true, sender: true },
								take: 1,
								orderBy: { receivedAt: "desc" },
							},
						},
					});
					if (!entity) {
						return { success: false, entityType: "", confidence: 0, summary: "", extractedFieldCount: 0, error: "Entity not found" };
					}
					const thread = entity.threads[0];
					if (!thread?.bodyText) {
						return { success: false, entityType: "", confidence: 0, summary: "", extractedFieldCount: 0, error: "No email body" };
					}
					const content = thread.bodyText;

					const mm = new MemoryManager();
					const classification = await classifyEmailWithMemory(
						{ subject: thread.subject, sender: thread.sender, content },
						entity.organizationId,
						mm,
					);
					const entityType = classification.type === "UNKNOWN" ? "FEEDBACK" : classification.type;
					let extractedFields: Record<string, unknown> = {};
					if (entityType === "APPROVAL") {
						extractedFields = await extractApprovalFields(content);
					} else if (entityType === "REPORT") {
						extractedFields = await extractReportFields(content);
					}

					const summary = await summarizeThread(content);

					await db.flowEntity.update({
						where: { id: entityId },
						data: {
							type: entityType as never,
							extractedFields: JSON.stringify(extractedFields),
							aiSummary: summary,
							aiConfidence: classification.confidence,
							requiresReview: classification.confidence < 0.7,
						},
					});
					await db.timelineEvent.create({
						data: {
							entityId,
							type: "ai_summary",
							content: `AI 重新分析完成：${entityType}（置信度 ${Math.round(classification.confidence * 100)}%）${summary ? `\n\n${summary}` : ""}`,
							metadata: JSON.stringify({ entityType, confidence: classification.confidence, trigger: "agent_re_enrich" }),
						},
					});
					return { success: true, entityType, confidence: classification.confidence, summary: summary || "(empty)", extractedFieldCount: Object.keys(extractedFields).length };
				} catch (err) {
					console.error("[re_enrich]", err instanceof Error ? err.message : err);
					return { success: false, entityType: "", confidence: 0, summary: "", extractedFieldCount: 0, error: err instanceof Error ? err.message : "Unknown error" };
				}
			},
		}),
	);

	registry.registerBuiltin(createAnalysisTools({ classifyEntityOnly }));

	registry.registerBuiltin(
		createEmailTools({
			getConnector: getConnector as unknown as Parameters<typeof createEmailTools>[0]["getConnector"],
			processEmail: processEmailRaw as unknown as Parameters<typeof createEmailTools>[0]["processEmail"],
			triggerNotification: notify,
		}),
	);

	registry.registerBuiltin(createInboxTools());
	registry.registerBuiltin(createAttachmentTools());

	registry.registerBuiltin(createSummarizeThreadTool());
	registry.registerBuiltin(createCompareEntitiesTool());
	registry.registerBuiltin(createReminderTool());
	registry.registerBuiltin(createSandboxTools());
	registry.registerBuiltin(createReplyTools());
	registry.registerBuiltin(createMemoryTools());

	if (options?.webSearchEnabled) {
		registry.registerBuiltin(createWebSearchTool());
	}

	return registry;
}

export async function POST(req: Request) {
	const ip = getClientIp(req);
	const rl = checkRateLimit(`agent-chat:${ip}`, RATE_LIMITS.agentChat);
	if (!rl.allowed) {
		return new Response(JSON.stringify({ error: "Too many requests" }), {
			status: 429,
			headers: {
				"Content-Type": "application/json",
				"X-RateLimit-Remaining": "0",
				"X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
			},
		});
	}

	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	let body: {
		messages: UIMessage[];
		pageContext?: PageContext;
		entityId?: string;
		organizationId?: string;
		webSearchEnabled?: boolean;
	};
	try {
		body = await req.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { messages, pageContext, webSearchEnabled } = body;

	const registry = createAgentToolRegistry({ webSearchEnabled });

	const ctx: PageContext = pageContext ?? {
		entityId: body.entityId,
		organizationId: body.organizationId,
	};

	if (ctx.organizationId) {
		const membership = await getOrganizationMembership(ctx.organizationId, session.user.id);
		if (!membership) {
			return new Response(JSON.stringify({ error: "Forbidden" }), {
				status: 403,
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	const lastMessage = messages[messages.length - 1];
	const userMessage =
		lastMessage?.role === "user"
			? lastMessage.parts
					?.filter((p): p is { type: "text"; text: string } => p.type === "text")
					.map((p) => p.text)
					.join(" ") ?? ""
			: "";

	const senderEmail = ctx.entity
		? undefined
		: undefined;

	const memoryContext = ctx.organizationId
		? await memoryManager.recallFocused({
				organizationId: ctx.organizationId,
				entityId: ctx.entityId,
				contactEmail: senderEmail,
				limit: 15,
			})
		: [];

	const orgId = ctx.organizationId;
	const objectContext = orgId
		? await (async () => {
				const objects = [];
				const selfObj = await memoryManager.getSelf(orgId, session.user.id);
				if (selfObj) {
					objects.push(selfObj);
				}
				if (senderEmail) {
					const contactObj = await memoryManager.getObject(orgId, "person", senderEmail);
					if (contactObj) {
						objects.push(contactObj);
					}
				}
				return objects;
			})()
		: [];

	const agentConfig = buildAgentConfig(
		{
			userMessage,
			pageContext: ctx,
			memoryContext,
			objectContext,
		},
		registry.getTools({
			organizationId: ctx.organizationId ?? "",
			userId: session.user.id,
			entityId: ctx.entityId,
		}),
	);

	const agent = new ToolLoopAgent({
		model: textModel,
		instructions: agentConfig.systemPrompt,
		tools: agentConfig.tools as ToolSet,
		stopWhen: stepCountIs(agentConfig.maxSteps),
	});

	const modelMessages = await convertToModelMessages(messages);

	const result = await agent.stream({
		messages: modelMessages,
	});

	if (ctx.organizationId) {
		// 检测用户消息中的纠正/确认信号，写入反馈记忆
		const correctionPatterns = /不对|不是|错了|别这样|取消|不要|停止|这不对|重新|改成/;
		const confirmationPatterns = /好的|对|没错|就这样|确认|通过|就是这个|很好|完全正确|继续/;

		if (userMessage.length > 2) {
			if (correctionPatterns.test(userMessage)) {
				memoryManager
					.recordFeedback({
						organizationId: ctx.organizationId,
						origin: "correction",
						content: `用户纠正了操作: "${userMessage.slice(0, 150)}"`,
						scopeId: ctx.entityId,
						scope: ctx.entityId ? "project" : "org",
						metadata: { userId: session.user.id, entityId: ctx.entityId },
					})
					.catch(() => {});
			} else if (confirmationPatterns.test(userMessage) && messages.length > 2) {
				// 确认信号需要至少有一轮对话（不是第一句话）
				memoryManager
					.recordFeedback({
						organizationId: ctx.organizationId,
						origin: "confirmation",
						content: `用户确认了操作方向: "${userMessage.slice(0, 150)}"`,
						scopeId: ctx.entityId,
						scope: ctx.entityId ? "project" : "org",
						metadata: { userId: session.user.id, entityId: ctx.entityId },
					})
					.catch(() => {});
			}
		}
	}

	return result.toUIMessageStreamResponse();
}
