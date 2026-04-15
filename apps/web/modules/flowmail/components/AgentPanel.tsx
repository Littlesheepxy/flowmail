"use client";

import { useChat } from "@ai-sdk/react";
import { cn, Spinner } from "@repo/ui";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import {
	DefaultChatTransport,
	type DynamicToolUIPart,
	getToolOrDynamicToolName,
	isReasoningUIPart,
	isTextUIPart,
	isToolOrDynamicToolUIPart,
	type UIMessage,
} from "ai";
import {
	AlertTriangleIcon,
	ArrowUpIcon,
	BrainIcon,
	CheckCircle2Icon,
	ChevronDownIcon,
	FileTextIcon,
	GlobeIcon,
	HistoryIcon,
	InboxIcon,
	RefreshCwIcon,
	SparklesIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { AgentCard, ToolSkeleton } from "../agent/AgentCards";
import { buildPageContext } from "../agent/build-page-context";
import type { AgentUICard } from "../agent/types";
import { useChatHistory } from "../hooks/use-chat-history";
import { getEntityTypeBadgeStatus, getEntityTypeLabel, getStatusLabel } from "../lib/entity-type-config";
import { useAgent } from "./AgentProvider";

interface AgentPanelProps {
	entityId: string | null;
	organizationId?: string;
	className?: string;
	onClose?: () => void;
	initialMessage?: string;
}

/** Tool 结果 → UI 卡片 */
function toolResultToBlock(
	toolName: string,
	result: Record<string, unknown>,
	entityCtx: {
		id: string;
		title: string;
		type: string;
		status: string;
	} | null,
): AgentUICard | null {
	if (result.error) {
		return null;
	}

	if (toolName === "approve_entity" || toolName === "reject_entity") {
		return {
			type: "action_result",
			data: {
				success: Boolean(result.success),
				action: toolName === "approve_entity" ? "approved" : "rejected",
				message:
					toolName === "approve_entity" ? "审批已通过" : "审批已拒绝",
				fromStatus: String(result.fromStatus ?? "pending"),
				toStatus: String(
					result.toStatus ??
						(toolName === "approve_entity"
							? "approved"
							: "rejected"),
				),
			},
		};
	}

	if (toolName === "predict_risk" && result.riskLevel) {
		return {
			type: "risk_card",
			data: {
				entityId: String(result.entityId ?? entityCtx?.id ?? ""),
				riskLevel: result.riskLevel as
					| "low"
					| "medium"
					| "high"
					| "critical",
				riskFactors: (result.riskFactors as string[]) ?? [],
				predictedOutcome: String(result.predictedOutcome ?? ""),
				suggestedActions: (result.suggestedActions as string[]) ?? [],
				deadlineRisk: (result.deadlineRisk ?? {
					hasDeadline: false,
					isAtRisk: false,
				}) as {
					hasDeadline: boolean;
					isAtRisk: boolean;
					deadline?: string | null;
					daysRemaining?: number | null;
				},
				confidence: Number(result.confidence ?? 0),
			},
		};
	}

	if (toolName === "get_timeline_diff" && result.summary) {
		return {
			type: "timeline_diff",
			data: {
				entityId: String(result.entityId ?? entityCtx?.id ?? ""),
				summary: String(result.summary ?? ""),
				changes: (result.changes ?? []) as [],
				riskSignals: (result.riskSignals as string[]) ?? [],
				progressDelta:
					result.progressDelta != null
						? Number(result.progressDelta)
						: null,
				recommendation: result.recommendation
					? String(result.recommendation)
					: null,
			},
		};
	}

	if (toolName === "list_pending_approvals" && result.items) {
		const items = result.items as Array<{
			id: string;
			title: string;
			type: string;
			status: string;
			aiConfidence?: number | null;
			updatedAt: string;
		}>;
		return {
			type: "entity_list",
			data: {
				totalCount: Number(result.count ?? items.length),
				filterLabel: "待审批事项",
				items,
			},
		};
	}

	if (toolName === "get_entity" && result.id) {
		const entityType = String(result.type ?? "");
		if (entityType === "APPROVAL") {
			const fields = (result.extractedFields ?? {}) as Record<
				string,
				string
			>;
			return {
				type: "approval_card",
				data: {
					entityId: String(result.id),
					title: String(result.title ?? ""),
					applicant: fields.applicant ?? fields.申请人,
					amount: fields.amount ?? fields.金额,
					purpose:
						fields.purpose ??
						fields.用途 ??
						String(result.aiSummary ?? ""),
					deadline: fields.deadline ?? fields.截止日期,
					urgency: fields.urgency ?? fields.紧急程度,
					currentStatus: String(result.status ?? "pending"),
				},
			};
		}
		if (entityType === "REPORT") {
			const fields = (result.extractedFields ?? {}) as Record<
				string,
				string
			>;
			return {
				type: "report_card",
				data: {
					entityId: String(result.id),
					title: String(result.title ?? ""),
					progress: fields.progress ?? fields.进度,
					weeklyVelocity: fields.weeklyVelocity ?? fields.本周速度,
					blockers: fields.blockers ?? fields.阻塞项,
					completedMilestones:
						fields.completedMilestones ?? fields.已完成里程碑,
					plannedCompletion:
						fields.plannedCompletion ?? fields.预计完成,
				},
			};
		}
	}

	if (
		(toolName === "add_note" || toolName === "update_entity_status") &&
		result.success
	) {
		return {
			type: "action_result",
			data: {
				success: true,
				action: toolName === "add_note" ? "add_note" : "update_status",
				message: toolName === "add_note" ? "备注已添加" : "状态已更新",
				fromStatus: result.fromStatus
					? String(result.fromStatus)
					: undefined,
				toStatus: result.toStatus ? String(result.toStatus) : undefined,
			},
		};
	}

	if (toolName === "list_connections" && result.connections) {
		const connections = result.connections as Array<{
			id: string;
			provider: string;
			email: string;
			isActive: boolean;
			lastSyncAt: string | null;
			authType: string;
		}>;
		return {
			type: "connection_list",
			data: {
				totalCount: Number(result.count ?? connections.length),
				connections,
			},
		};
	}

	if (toolName === "sync_emails" && result.fetched != null) {
		return {
			type: "sync_result",
			data: {
				email: String(result.email ?? ""),
				provider: String(result.provider ?? ""),
				fetched: Number(result.fetched ?? 0),
				processed: Number(result.processed ?? 0),
				errors: Number(result.errors ?? 0),
			},
		};
	}

	if (toolName === "send_email") {
		return {
			type: "send_result",
			data: {
				success: Boolean(result.success),
				provider: String(result.provider ?? ""),
				from: String(result.from ?? ""),
				to: (result.to as string[]) ?? [],
				subject: String(result.subject ?? ""),
				error: result.error ? String(result.error) : undefined,
			},
		};
	}

	if (toolName === "search_emails" && result.emails) {
		const emails = result.emails as Array<{
			id: string;
			subject: string;
			sender: string;
			senderEmail: string;
			snippet: string | null;
			receivedAt: string;
			entity: {
				id: string;
				title: string;
				type: string;
				status: string;
			} | null;
		}>;
		return {
			type: "email_search",
			data: { totalCount: Number(result.count ?? emails.length), emails },
		};
	}

	if (toolName === "ask_user" && result.question) {
		return {
			type: "ask_user",
			data: {
				question: String(result.question),
				options: (result.options as Array<{ label: string; value: string }>) ?? [],
				context: result.context ? String(result.context) : undefined,
				awaiting: Boolean(result.awaiting),
			},
		};
	}

	return null;
}

// ── 工具名称映射 ─────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
	get_entity: "正在获取事项详情...",
	read_email_body: "正在读取邮件正文...",
	re_enrich_entity: "正在重新 AI 分析...",
	ask_user: "正在准备问题...",
	web_search: "正在搜索网络...",
	summarize_thread: "正在综合摘要...",
	compare_entities: "正在对比分析...",
	create_reminder: "正在设置提醒...",
	approve_entity: "正在执行批准...",
	reject_entity: "正在执行拒绝...",
	predict_risk: "正在分析风险...",
	get_timeline_diff: "正在分析时间线变化...",
	add_note: "正在添加备注...",
	update_entity_status: "正在更新状态...",
	update_entity_type: "正在重新分类...",
	batch_reclassify: "正在检查分类准确性...",
	list_entities: "正在检索事项...",
	get_inbox_summary: "正在获取收件箱概览...",
	list_pending_approvals: "正在查询待审批事项...",
	list_connections: "正在查询邮箱连接...",
	sync_emails: "正在同步邮件...",
	send_email: "正在发送邮件...",
	search_emails: "正在搜索邮件...",
	batch_enrich: "正在批量 AI 分析...",
	draft_reply: "正在起草回复...",
	learn_reply_style: "正在学习写作风格...",
	upsert_memory_object: "正在更新记忆...",
	run_code: "正在执行代码...",
	run_python: "正在执行 Python...",
};

function toolLabel(name: string): string {
	return TOOL_LABELS[name] ?? `正在执行 ${name}...`;
}

// ── 快捷建议 ─────────────────────────────────────────────

const ALL_SCOPE_SUGGESTIONS = [
	"查看待审批事项",
	"本周汇报概览",
	"有哪些高风险事项？",
	"同步最新邮件",
	"搜索包含发票的邮件",
	"最近一周的事项统计",
];

function formatTimeAgo(isoStr: string): string {
	const diff = Date.now() - new Date(isoStr).getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) {
		return "刚刚";
	}
	if (minutes < 60) {
		return `${minutes} 分钟前`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours} 小时前`;
	}
	const days = Math.floor(hours / 24);
	if (days < 7) {
		return `${days} 天前`;
	}
	return new Date(isoStr).toLocaleDateString("zh-CN");
}

function getSuggestions(
	scope: AgentScope,
	type: string | null,
	status: string | null,
): string[] {
	if (scope === "all" || !type) {
		return ALL_SCOPE_SUGGESTIONS;
	}

	if (type === "APPROVAL") {
		if (status === "pending") {
			return ["分析这个审批", "评估风险", "批准", "拒绝", "起草回复"];
		}
		return ["查看审批详情", "查看时间线变化", "起草回复"];
	}
	if (type === "REPORT") {
		if (status === "in_progress" || status === "received") {
			return [
				"总结项目进展",
				"分析风险",
				"查看最近变化",
				"对比上期汇报",
				"标记风险项",
			];
		}
		return ["查看汇报详情", "提取关键数据", "分析风险"];
	}
	if (type === "ISSUE") {
		return ["分析这个问题", "评估风险和影响", "查看处理进展", "起草回复"];
	}
	if (type === "NOISE") {
		return ["重新分类这封邮件", "这不是垃圾邮件", "查看邮件详情"];
	}
	return ["总结这个事项", "分析风险", "查看时间线变化", "起草回复"];
}

// ── Markdown 渲染 ────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			components={{
				p: ({ children }) => (
					<p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
				),
				ul: ({ children }) => (
					<ul className="mb-2 ml-4 list-disc space-y-1">
						{children}
					</ul>
				),
				ol: ({ children }) => (
					<ol className="mb-2 ml-4 list-decimal space-y-1">
						{children}
					</ol>
				),
				li: ({ children }) => (
					<li className="leading-relaxed">{children}</li>
				),
				strong: ({ children }) => (
					<strong className="font-semibold">{children}</strong>
				),
				code: ({ children, className }) => {
					const isBlock = className?.includes("language-");
					if (isBlock) {
						return (
							<code className="block rounded-lg bg-black/10 dark:bg-white/10 px-3 py-2 text-xs font-mono my-2 overflow-x-auto">
								{children}
							</code>
						);
					}
					return (
						<code className="rounded bg-black/10 dark:bg-white/10 px-1.5 py-0.5 text-xs font-mono">
							{children}
						</code>
					);
				},
				h1: ({ children }) => (
					<h1 className="text-base font-bold mb-2">{children}</h1>
				),
				h2: ({ children }) => (
					<h2 className="text-sm font-bold mb-1.5">{children}</h2>
				),
				h3: ({ children }) => (
					<h3 className="text-sm font-semibold mb-1">{children}</h3>
				),
				table: ({ children }) => (
					<div className="my-2 overflow-x-auto rounded-lg border">
						<table className="w-full text-xs">{children}</table>
					</div>
				),
				thead: ({ children }) => (
					<thead className="bg-muted/50 border-b">{children}</thead>
				),
				tbody: ({ children }) => <tbody>{children}</tbody>,
				tr: ({ children }) => (
					<tr className="border-b last:border-b-0">{children}</tr>
				),
				th: ({ children }) => (
					<th className="px-2.5 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">
						{children}
					</th>
				),
				td: ({ children }) => (
					<td className="px-2.5 py-1.5 align-top">{children}</td>
				),
				blockquote: ({ children }) => (
					<blockquote className="border-l-2 border-current/30 pl-3 italic opacity-80 my-2">
						{children}
					</blockquote>
				),
				a: ({ href, children }) => {
					const isSafe = href && /^(https?:|mailto:)/i.test(href);
					return (
						<a
							href={isSafe ? href : undefined}
							target="_blank"
							rel="noopener noreferrer"
							className="underline underline-offset-2 hover:opacity-80 text-primary"
							onClick={isSafe ? undefined : (e) => e.preventDefault()}
						>
							{children}
						</a>
					);
				},
			}}
		>
			{content}
		</ReactMarkdown>
	);
}

// ── 思考过程 ─────────────────────────────────────────────

function ReasoningToggle({ text }: { text: string }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="rounded-lg border bg-muted/40">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/60 transition-colors rounded-lg"
			>
				<BrainIcon className="size-3" />
				<span>思考过程</span>
				<ChevronDownIcon
					className={cn(
						"size-3 ml-auto transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>
			{open && (
				<div className="px-2.5 pb-2 pt-0.5">
					<p className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
						{text.length > 500 ? text.slice(0, 500) + "…" : text}
					</p>
				</div>
			)}
		</div>
	);
}

// ── Block 渲染器 ─────────────────────────────────────────

// ── 记忆写入提示 ─────────────────────────────────────────

function showMemoryToast(title: string, detail: string, organizationId?: string) {
	toast(title, {
		description: detail ? (detail.length > 80 ? `${detail.slice(0, 80)}…` : detail) : undefined,
		duration: 6000,
		action: organizationId
			? {
					label: "查看记忆",
					onClick: () => {
						const event = new CustomEvent("flowmail:open-settings", {
							detail: { tab: "ai-memory" },
						});
						window.dispatchEvent(event);
					},
				}
			: undefined,
	});
}

// ── 主组件 ───────────────────────────────────────────────

type AgentScope = "entity" | "all";

export function AgentPanel({
	entityId,
	organizationId,
	className,
	onClose,
	initialMessage,
}: AgentPanelProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [input, setInput] = useState(initialMessage ?? "");
	const initialConsumedRef = useRef(false);
	const [scope, setScope] = useState<AgentScope>("entity");
	const [webSearchEnabled, setWebSearchEnabled] = useState(false);
	const pathname = usePathname();

	const effectiveEntityId = scope === "all" ? null : entityId;

	const { data: entity } = useQuery({
		...orpc.flowEntities.get.queryOptions({
			input: { entityId: effectiveEntityId ?? "" },
		}),
		enabled: !!effectiveEntityId,
	});

	const entityCtx = entity
		? {
				id: entity.id,
				title: entity.title,
				type: entity.type,
				status: entity.status,
			}
		: null;

	const pageContext = useMemo(
		() =>
			buildPageContext({
				route: pathname,
				organizationId,
				entity: entity
					? {
							id: entity.id,
							title: entity.title,
							type: entity.type,
							status: entity.status,
							aiSummary: entity.aiSummary,
							extractedFields: entity.extractedFields as
								| string
								| null,
							aiConfidence: entity.aiConfidence,
							timeline: (entity.timeline ?? []).map((e) => ({
								type: e.type,
								content: e.content,
								createdAt: e.createdAt.toString(),
							})),
						}
					: null,
			}),
		[pathname, organizationId, entity],
	);

	const pageContextRef = useRef(pageContext);
	pageContextRef.current = pageContext;

	const webSearchRef = useRef(webSearchEnabled);
	webSearchRef.current = webSearchEnabled;

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/agent/chat",
				body: () => ({
					pageContext: pageContextRef.current,
					webSearchEnabled: webSearchRef.current,
				}),
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	const { messages, sendMessage, status, setMessages, error } = useChat({
		transport,
	});
	const { pendingExecution, consumeExecution } = useAgent();
	const chatHistory = useChatHistory();
	const [historyOpen, setHistoryOpen] = useState(false);

	const isLoading = status === "streaming" || status === "submitted";
	const hasError = status === "error";
	const hasMessages = messages.length > 0;

	useEffect(() => {
		if (messages.length > 0 && !isLoading) {
			chatHistory.saveSession(
				scope,
				effectiveEntityId,
				entity?.title ?? null,
				messages as UIMessage[],
			);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [messages, isLoading]);

	useEffect(() => {
		setMessages([]);
		setInput("");
		initialConsumedRef.current = false;
		chatHistory.startNewSession();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [entityId, setMessages]);

	useEffect(() => {
		if (initialMessage && !initialConsumedRef.current) {
			initialConsumedRef.current = true;
			setInput(initialMessage);
		}
	}, [initialMessage]);

	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [messages]);

	const shownMemoryToasts = useRef(new Set<string>());
	useEffect(() => {
		for (const msg of messages as UIMessage[]) {
			if (msg.role !== "assistant") {
				continue;
			}
			for (const part of msg.parts ?? []) {
				if (!isToolOrDynamicToolUIPart(part)) {
					continue;
				}
				const dynP = part as DynamicToolUIPart;
				if (dynP.state !== "output-available") {
					continue;
				}
				const toastKey = dynP.toolCallId;
				if (shownMemoryToasts.current.has(toastKey)) {
					continue;
				}
				const output = dynP.output as Record<string, unknown>;
				const toolName = getToolOrDynamicToolName(part);
				if (toolName === "learn_reply_style" && output.success) {
					shownMemoryToasts.current.add(toastKey);
					showMemoryToast(
						`已学习邮件写作风格（分析了 ${output.samplesAnalyzed ?? 0} 封邮件）`,
						String(output.styleAnalysis ?? ""),
						organizationId,
					);
				}
				if (output._memoryWritten) {
					shownMemoryToasts.current.add(toastKey);
					const isNew = output.isNew;
					const fields = Array.isArray(output.changedFields)
						? (output.changedFields as string[]).join("、")
						: "";
					const desc = isNew ? "创建了新记忆对象" : fields ? `更新了 ${fields}` : "更新了记忆";
					showMemoryToast(desc, "", organizationId);
				}
			}
		}
	}, [messages, organizationId]);

	useEffect(() => {
		if (!pendingExecution || isLoading) {
			return;
		}
		const exec = consumeExecution();
		if (!exec) {
			return;
		}
		const instruction = [
			"请执行以下操作：" + exec.actionLabel,
			"",
			"背景：" + exec.suggestionMessage,
			'事项："' + exec.entityTitle + '" (ID: ' + exec.entityId + ")",
			"建议工具：" + exec.actionTool,
			exec.actionParams && Object.keys(exec.actionParams).length > 0
				? "参数：" + JSON.stringify(exec.actionParams)
				: "",
			"",
			"请根据上下文自主判断需要执行哪些操作，不要只是描述，直接调用工具执行。",
		]
			.filter(Boolean)
			.join("\n");

		sendMessage({ text: instruction });
	}, [pendingExecution, isLoading, consumeExecution, sendMessage]);

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const text = input.trim();
		if (!text || isLoading) {
			return;
		}
		setInput("");
		sendMessage({ text });
	}

	function handleSuggestionClick(text: string) {
		if (isLoading) {
			return;
		}
		sendMessage({ text });
	}

	const suggestions = getSuggestions(
		scope,
		entity?.type ?? null,
		entity?.status ?? null,
	);

	return (
		<div data-module="agent" className={cn("h-full", className)}>
			<div className="h-full agent-panel-border">
				<div className="agent-panel-inner">
					{/* Header */}
					<div className="px-4 py-3 flex items-center justify-between shrink-0 border-b agent-header-gradient">
						<div className="flex items-center gap-2">
							<div className="flex items-center justify-center size-6 rounded-lg bg-foreground shadow-sm">
								<SparklesIcon className="size-3.5 text-background" />
							</div>
							<span className="text-sm font-semibold">
								Flowmail Agent
							</span>
							{isLoading && (
								<span className="text-[10px] text-(--agent-accent) flex items-center gap-1 font-medium">
									<Spinner className="size-2.5" />
									思考中
								</span>
							)}
						</div>
						<div className="flex items-center gap-1">
							<Popover open={historyOpen} onOpenChange={setHistoryOpen}>
								<PopoverTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="size-7 text-muted-foreground hover:text-foreground"
										onClick={() => {
											chatHistory.refresh();
											setHistoryOpen(true);
										}}
									>
										<HistoryIcon className="size-3" />
									</Button>
								</PopoverTrigger>
								<PopoverContent
									align="end"
									className="w-72 p-0 max-h-80 overflow-hidden"
								>
									<div className="px-3 py-2.5 border-b flex items-center justify-between">
										<span className="text-xs font-semibold">聊天记录</span>
										{chatHistory.sessions.length > 0 && (
											<button
												type="button"
												onClick={() => {
													chatHistory.clearAll();
												}}
												className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
											>
												清空
											</button>
										)}
									</div>
									<div className="overflow-y-auto max-h-64">
										{chatHistory.sessions.length === 0 ? (
											<div className="px-3 py-6 text-center text-xs text-muted-foreground">
												暂无聊天记录
											</div>
										) : (
											chatHistory.sessions.map((session) => {
												const preview = chatHistory.getFirstUserMessage(session.messages);
												const timeAgo = formatTimeAgo(session.updatedAt);
												return (
													<button
														type="button"
														key={session.id}
														className="px-3 py-2.5 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 group transition-colors w-full text-left"
														onClick={() => {
															const loaded = chatHistory.loadSession(session.id);
															if (loaded) {
																setScope(loaded.scope);
																setMessages(loaded.messages);
																setHistoryOpen(false);
															}
														}}
													>
														<div className="flex items-center gap-1.5 mb-1">
															<Badge
																className="h-4 rounded-sm px-1.5 py-0 text-[10px]"
																status={session.scope === "entity" ? "info" : "warning"}
															>
																{session.scope === "entity" ? (
																	<><FileTextIcon className="size-2.5 mr-0.5" />当前事项</>
																) : (
																	<><InboxIcon className="size-2.5 mr-0.5" />全部</>
																)}
															</Badge>
															{session.entityTitle && (
																<span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
																	{session.entityTitle}
																</span>
															)}
															<button
																type="button"
																className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
																onClick={(e) => {
																	e.stopPropagation();
																	chatHistory.deleteSession(session.id);
																}}
															>
																<Trash2Icon className="size-3" />
															</button>
														</div>
														<p className="text-xs truncate text-foreground/80">
															{preview || "（空对话）"}
														</p>
														<p className="text-[10px] text-muted-foreground mt-0.5">
															{timeAgo}
														</p>
													</button>
												);
											})
										)}
									</div>
								</PopoverContent>
							</Popover>
							{hasMessages && (
								<Button
									variant="ghost"
									size="icon"
									className="size-7 text-muted-foreground hover:text-foreground"
									onClick={() => {
										setMessages([]);
										chatHistory.startNewSession();
									}}
								>
									<RefreshCwIcon className="size-3" />
								</Button>
							)}
							{onClose && (
								<Button
									variant="ghost"
									size="icon"
									className="size-7 text-muted-foreground hover:text-foreground"
									onClick={onClose}
								>
									<XIcon className="size-3.5" />
								</Button>
							)}
						</div>
					</div>

					{/* 范围切换 */}
					{entityId && (
						<div className="mx-3 mt-2 flex rounded-lg bg-muted/50 p-0.5 shrink-0">
							<button
								type="button"
								onClick={() => {
									if (scope !== "entity") {
										setScope("entity");
										setMessages([]);
									}
								}}
								className={cn(
									"flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5",
									scope === "entity"
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<FileTextIcon className="size-3" />
								当前事项
							</button>
							<button
								type="button"
								onClick={() => {
									if (scope !== "all") {
										setScope("all");
										setMessages([]);
									}
								}}
								className={cn(
									"flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5",
									scope === "all"
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<InboxIcon className="size-3" />
								全部
							</button>
						</div>
					)}

					{/* 当前 entity 上下文 */}
					{entity && scope === "entity" && (
						<div className="mx-3 mt-3 rounded-lg border bg-muted/30 px-3 py-2.5 shrink-0">
							<div className="flex items-center gap-1.5 mb-0.5">
								<div className="size-1.5 rounded-full bg-(--agent-accent) shrink-0" />
								<Badge
									status={getEntityTypeBadgeStatus(entity.type)}
									className="h-4 rounded-sm px-1.5 py-0 text-[10px]"
								>
									{getEntityTypeLabel(entity.type)}
								</Badge>
								<Badge
									status={
										entity.status === "pending"
											? "warning"
											: entity.status === "approved" ||
													entity.status ===
														"completed"
												? "success"
												: entity.status === "rejected"
													? "error"
													: "info"
									}
									className="h-4 rounded-sm px-1.5 py-0 text-[10px]"
								>
									{getStatusLabel(entity.status)}
								</Badge>
								{entity.aiConfidence != null && (
									<span className="ml-auto text-[10px] text-muted-foreground">
										AI{" "}
										{Math.round(entity.aiConfidence * 100)}%
									</span>
								)}
							</div>
							<p className="text-xs font-medium truncate">
								{entity.title}
							</p>
						</div>
					)}

					{/* 消息列表 */}
					<div
						ref={scrollRef}
						className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
					>
						{!effectiveEntityId && !hasMessages && (
							<div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 pb-8 gap-3">
								<div className="flex items-center justify-center size-10 rounded-xl bg-foreground/5 border border-border/50">
									<InboxIcon className="size-5 text-muted-foreground/40" />
								</div>
								<div className="text-center">
									<p className="text-xs font-medium text-muted-foreground/70 mb-1">
										收件箱助手
									</p>
									<p className="text-[11px] text-center leading-relaxed">
										查看所有事项、搜索邮件、批量操作
										<br />
										试试下面的快捷操作
									</p>
								</div>
							</div>
						)}

						{effectiveEntityId && !hasMessages && (
							<div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 pb-8 gap-3">
								<div className="flex items-center justify-center size-10 rounded-xl bg-foreground/5 border border-border/50">
									<FileTextIcon className="size-5 text-muted-foreground/40" />
								</div>
								<div className="text-center">
									<p className="text-xs font-medium text-muted-foreground/70 mb-1">
										事项助手
									</p>
									<p className="text-[11px] text-center leading-relaxed">
										分析、审批、回复当前事项
										<br />
										试试下面的快捷操作
									</p>
								</div>
							</div>
						)}

						{(messages as UIMessage[]).map((msg) => {
							if (msg.role === "user") {
								const userText = (msg.parts ?? [])
									.filter(isTextUIPart)
									.map((p) => p.text)
									.join("");
								return (
									<div
										key={msg.id}
										className="flex justify-end"
									>
										<div className="max-w-[88%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2.5">
											<p className="text-sm leading-relaxed whitespace-pre-wrap">
												{userText}
											</p>
										</div>
									</div>
								);
							}

							if (msg.role === "assistant") {
								const parts = msg.parts ?? [];

								const completedToolCallIds = new Set<string>();
								for (const p of parts) {
									if (isToolOrDynamicToolUIPart(p)) {
										const tp = p as DynamicToolUIPart;
										if (
											tp.state === "output-available" ||
											tp.state === "output-error"
										) {
											completedToolCallIds.add(
												tp.toolCallId,
											);
										}
									}
								}

							const hasVisibleContent = parts.some(
								(p) =>
									(isTextUIPart(p) && p.text) ||
									(isReasoningUIPart(p) && p.text) ||
									(isToolOrDynamicToolUIPart(p) &&
										!completedToolCallIds.has(
											(p as DynamicToolUIPart).toolCallId,
										) &&
										((p as DynamicToolUIPart).state === "input-streaming" ||
											(p as DynamicToolUIPart).state === "input-available")) ||
									(isToolOrDynamicToolUIPart(p) &&
										((p as DynamicToolUIPart).state === "output-available" ||
											(p as DynamicToolUIPart).state === "output-error")),
							);

							// 当 assistant message 暂无可见内容但正在 loading，显示思考中 skeleton
							const isLastMessage = msg === (messages as UIMessage[]).at(-1);
							if (!hasVisibleContent) {
								if (isLoading && isLastMessage) {
									return (
										<div
											key={msg.id}
											className="flex justify-start"
										>
											<div className="flex items-center gap-2 text-muted-foreground px-1 py-1">
												<Spinner className="size-3.5" />
												<span className="text-xs">Agent 正在处理...</span>
											</div>
										</div>
									);
								}
								return null;
							}

								return (
									<div
										key={msg.id}
										className="flex justify-start"
									>
										<div className="max-w-[92%] space-y-2">
											{parts.map((part, i) => {
												if (isReasoningUIPart(part)) {
													return part.text ? (
														<ReasoningToggle
															key={`${msg.id}-r-${i}`}
															text={part.text}
														/>
													) : null;
												}

												if (
													isTextUIPart(part) &&
													part.text
												) {
													return (
														<div
															key={`${msg.id}-t-${i}`}
															className="rounded-2xl rounded-bl-sm bg-muted/60 border px-3.5 py-2.5 text-sm text-foreground"
														>
															<MarkdownContent
																content={
																	part.text
																}
															/>
														</div>
													);
												}

												if (
													isToolOrDynamicToolUIPart(
														part,
													)
												) {
													const dynP =
														part as DynamicToolUIPart;
													const toolName =
														getToolOrDynamicToolName(
															part,
														);

													if (
														dynP.state ===
															"input-streaming" ||
														dynP.state ===
															"input-available"
													) {
														if (
															completedToolCallIds.has(
																dynP.toolCallId,
															)
														) {
															return null;
														}
														return (
															<div
																key={`${msg.id}-tool-${i}`}
																className="animate-in fade-in duration-200"
															>
																<ToolSkeleton
																	toolName={
																		toolName
																	}
																/>
															</div>
														);
													}

													if (
														dynP.state ===
														"output-error"
													) {
														return (
															<div
																key={`${msg.id}-tool-${i}`}
																className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-center gap-1.5"
															>
																<AlertTriangleIcon className="size-3 shrink-0" />
																{toolLabel(
																	toolName,
																)}
																失败
															</div>
														);
													}

													if (
														dynP.state ===
														"output-available"
													) {
														const output =
															dynP.output as Record<
																string,
																unknown
															>;
														const card =
															toolResultToBlock(
																toolName,
																output,
																entityCtx,
															);
														if (card) {
															return (
																<div
																	key={`${msg.id}-tool-${i}`}
																	className="animate-in fade-in slide-in-from-bottom-2 duration-300"
																>
																	<AgentCard
																		card={card}
																		onSendMessage={(text) => sendMessage({ text })}
																	/>
																</div>
															);
														}
														return (
															<div
																key={`${msg.id}-tool-${i}`}
																className="flex items-center gap-1.5 text-xs text-muted-foreground/70 px-1 py-0.5"
															>
																<CheckCircle2Icon className="size-3 text-emerald-500" />
																<span>
																	{toolLabel(
																		toolName,
																	)
																		.replace(
																			"正在",
																			"已完成",
																		)
																		.replace(
																			"...",
																			"",
																		)}
																</span>
															</div>
														);
													}
												}

												return null;
											})}
										</div>
									</div>
								);
							}

							return null;
						})}

					{isLoading &&
						(messages as UIMessage[]).at(-1)?.role === "user" && (
							<div className="flex items-center gap-2 text-muted-foreground px-1">
								<Spinner className="size-3.5" />
								<span className="text-xs">
									Agent 正在思考...
								</span>
							</div>
						)}

						{hasError && (
							<div className="mx-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
								<p className="text-xs text-destructive">
									⚠️ Agent 遇到错误
									{error?.message
										? `：${error.message.slice(0, 80)}`
										: "，请重试"}
								</p>
								<button
									type="button"
									onClick={() => setMessages([])}
									className="mt-1.5 text-[11px] text-destructive/80 hover:text-destructive underline"
								>
									清除对话重试
								</button>
							</div>
						)}
					</div>

					{/* 初始快捷建议 */}
					{suggestions.length > 0 && !hasMessages && (
						<div className="px-3 pb-2 flex gap-1.5 flex-wrap shrink-0">
							{suggestions.map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => handleSuggestionClick(s)}
									className="text-[11px] px-3 py-1.5 rounded-full border bg-muted/30 text-muted-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-all"
								>
									{s}
								</button>
							))}
						</div>
					)}

					{/* 输入框 */}
					<form
						onSubmit={handleSubmit}
						className="px-3 pb-3 pt-1 shrink-0"
					>
						<div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 agent-input-focus transition-all">
							<button
								type="button"
								onClick={() =>
									setWebSearchEnabled((v) => !v)
								}
								className={cn(
									"flex items-center justify-center size-7 rounded-full transition-all shrink-0",
									webSearchEnabled
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted",
								)}
								title={
									webSearchEnabled
										? "网络搜索已开启"
										: "开启网络搜索"
								}
							>
								<GlobeIcon className="size-3.5" />
							</button>
							<input
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder={
								entity
									? `问关于「${entity.title.slice(0, 12)}...」的问题`
									: "收件箱概览、搜索、分类…"
								}
								className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
								disabled={isLoading}
							/>
							<button
								type="submit"
								disabled={!input.trim() || isLoading}
								className="flex items-center justify-center size-7 rounded-full bg-foreground text-background disabled:opacity-20 transition-all hover:opacity-80"
							>
								{isLoading ? (
									<Spinner className="size-3.5" />
								) : (
									<ArrowUpIcon className="size-4" />
								)}
							</button>
						</div>
						{webSearchEnabled && (
							<p className="text-[10px] text-muted-foreground/60 mt-1 ml-1">
								🌐 网络搜索已开启 — Agent 可搜索互联网获取实时信息
							</p>
						)}
					</form>
				</div>
			</div>
		</div>
	);
}
