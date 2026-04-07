import {
	buildAgentConfig,
	createAnalysisTools,
	createClassificationTools,
	createEmailTools,
	createEntityTools,
	createInboxTools,
	MemoryManager,
	type PageContext,
	ToolRegistry,
} from "@repo/agent";
import {
	convertToModelMessages,
	stepCountIs,
	ToolLoopAgent,
	type ToolSet,
	textModel,
	type UIMessage,
} from "@repo/ai";
import {
	checkRateLimit,
	getClientIp,
	RATE_LIMITS,
	triggerNotification,
} from "@repo/api";
import { auth } from "@repo/auth";
import { db, getOrganizationMembership } from "@repo/database";
import { getConnector, processEmail } from "@repo/email-processor";

export const maxDuration = 60;

const memoryManager = new MemoryManager();

function createAgentToolRegistry() {
	const registry = new ToolRegistry();

	const notify = (p: {
		organizationId: string;
		type: string;
		entityId: string;
		title: string;
		body: string;
	}) =>
		triggerNotification({
			organizationId: p.organizationId,
			type: p.type as Parameters<typeof triggerNotification>[0]["type"],
			entityId: p.entityId,
			title: p.title,
			body: p.body,
		});

	registry.registerBuiltin(
		createEntityTools({ triggerNotification: notify }),
	);

	registry.registerBuiltin(createAnalysisTools());

	registry.registerBuiltin(
		createEmailTools({
			getConnector: getConnector as unknown as Parameters<
				typeof createEmailTools
			>[0]["getConnector"],
			processEmail: processEmail as unknown as Parameters<
				typeof createEmailTools
			>[0]["processEmail"],
			triggerNotification: notify,
		}),
	);

	registry.registerBuiltin(createInboxTools());

	registry.registerBuiltin(
		createClassificationTools({
			processEmail: processEmail as unknown as Parameters<
				typeof createClassificationTools
			>[0]["processEmail"],
		}),
	);

	return registry;
}

const registry = createAgentToolRegistry();

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
	};
	try {
		body = await req.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { messages, pageContext } = body;

	const orgId = pageContext?.organizationId ?? body.organizationId;

	if (!orgId) {
		return new Response(
			JSON.stringify({ error: "organizationId is required" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	const membership = await getOrganizationMembership(orgId, session.user.id);
	if (!membership) {
		return new Response(JSON.stringify({ error: "Forbidden" }), {
			status: 403,
			headers: { "Content-Type": "application/json" },
		});
	}

	const unclassifiedEmailCount = await db.emailThread
		.count({ where: { organizationId: orgId, entityId: null } })
		.catch(() => undefined);

	const ctx: PageContext = pageContext
		? { ...pageContext, organizationId: orgId, unclassifiedEmailCount }
		: {
				entityId: body.entityId,
				organizationId: orgId,
				unclassifiedEmailCount,
			};

	const lastMessage = messages[messages.length - 1];
	const userMessage =
		lastMessage?.role === "user"
			? (lastMessage.parts
					?.filter(
						(p): p is { type: "text"; text: string } =>
							p.type === "text",
					)
					.map((p) => p.text)
					.join(" ") ?? "")
			: "";

	const senderEmail = ctx.entity ? undefined : undefined;

	const memoryContext = ctx.organizationId
		? await memoryManager.recallFocused({
				organizationId: ctx.organizationId,
				entityId: ctx.entityId,
				contactEmail: senderEmail,
				limit: 15,
			})
		: [];

	const agentConfig = buildAgentConfig(
		{
			userMessage,
			pageContext: ctx,
			memoryContext,
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

	if (ctx.organizationId && ctx.entityId) {
		memoryManager
			.recordDecision({
				organizationId: ctx.organizationId,
				entityId: ctx.entityId,
				decision: `Agent 响应用户请求: "${userMessage.slice(0, 100)}"`,
				metadata: { userId: session.user.id },
			})
			.catch(() => {});
	}

	return result.toUIMessageStreamResponse();
}
