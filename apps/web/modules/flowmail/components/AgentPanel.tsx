"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Spinner, cn } from "@repo/ui";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import {
	DefaultChatTransport,
	isTextUIPart,
	isReasoningUIPart,
	isToolOrDynamicToolUIPart,
	getToolOrDynamicToolName,
	type UIMessage,
	type DynamicToolUIPart,
} from "ai";
import {
	AlertTriangleIcon,
	BotIcon,
	BrainIcon,
	ChevronDownIcon,
	SendIcon,
	SparklesIcon,
	XIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useEffect, useRef, useState, useMemo, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AgentCard, ToolSkeleton } from "../agent/AgentCards";
import { buildPageContext } from "../agent/build-page-context";
import type { AgentUICard } from "../agent/types";
import { useAgent } from "./AgentProvider";

interface AgentPanelProps {
	entityId: string | null;
	organizationId?: string;
	className?: string;
	onClose?: () => void;
}

/** Tool 结果 → UI 卡片 */
function toolResultToBlock(
	toolName: string,
	result: Record<string, unknown>,
	entityCtx: { id: string; title: string; type: string; status: string } | null,
): AgentUICard | null {
	if (result.error) { return null; }

	if (toolName === "approve_entity" || toolName === "reject_entity") {
		return {
			type: "action_result",
			data: {
				success:    Boolean(result.success),
				action:     toolName === "approve_entity" ? "approved" : "rejected",
				message:    toolName === "approve_entity" ? "审批已通过" : "审批已拒绝",
				fromStatus: String(result.fromStatus ?? "pending"),
				toStatus:   String(result.toStatus ?? (toolName === "approve_entity" ? "approved" : "rejected")),
			},
		};
	}

	if (toolName === "predict_risk" && result.riskLevel) {
		return {
			type: "risk_card",
			data: {
				entityId:         String(result.entityId ?? entityCtx?.id ?? ""),
				riskLevel:        result.riskLevel as "low" | "medium" | "high" | "critical",
				riskFactors:      (result.riskFactors as string[]) ?? [],
				predictedOutcome: String(result.predictedOutcome ?? ""),
				suggestedActions: (result.suggestedActions as string[]) ?? [],
				deadlineRisk:     (result.deadlineRisk ?? { hasDeadline: false, isAtRisk: false }) as { hasDeadline: boolean; isAtRisk: boolean; deadline?: string | null; daysRemaining?: number | null },
				confidence:       Number(result.confidence ?? 0),
			},
		};
	}

	if (toolName === "get_timeline_diff" && result.summary) {
		return {
			type: "timeline_diff",
			data: {
				entityId:       String(result.entityId ?? entityCtx?.id ?? ""),
				summary:        String(result.summary ?? ""),
				changes:        (result.changes ?? []) as [],
				riskSignals:    (result.riskSignals as string[]) ?? [],
				progressDelta:  result.progressDelta != null ? Number(result.progressDelta) : null,
				recommendation: result.recommendation ? String(result.recommendation) : null,
			},
		};
	}

	if (toolName === "list_pending_approvals" && result.items) {
		const items = result.items as Array<{ id: string; title: string; type: string; status: string; aiConfidence?: number | null; updatedAt: string }>;
		return {
			type: "entity_list",
			data: { totalCount: Number(result.count ?? items.length), filterLabel: "待审批事项", items },
		};
	}

	return null;
}

// ── 工具名称映射 ─────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
	get_entity: "正在获取事项详情...",
	approve_entity: "正在执行批准...",
	reject_entity: "正在执行拒绝...",
	predict_risk: "正在分析风险...",
	get_timeline_diff: "正在分析时间线变化...",
	add_note: "正在添加备注...",
	update_entity_status: "正在更新状态...",
	list_pending_approvals: "正在查询待审批事项...",
};

function toolLabel(name: string): string {
	return TOOL_LABELS[name] ?? `正在执行 ${name}...`;
}

// ── 快捷建议 ─────────────────────────────────────────────

function getSuggestions(type: string, status: string): string[] {
	if (type === "APPROVAL") {
		if (status === "pending") {
			return ["分析这个审批", "评估风险", "批准", "拒绝"];
		}
		return ["查看审批详情", "查看时间线变化"];
	}
	if (type === "REPORT") {
		if (status === "in_progress" || status === "received") {
			return ["总结项目进展", "分析风险", "查看最近变化", "有什么需要跟进的？"];
		}
		return ["查看汇报详情", "分析风险"];
	}
	if (type === "ISSUE") {
		return ["分析这个问题", "评估风险和影响", "查看处理进展"];
	}
	return ["分析这个事项", "评估风险", "查看时间线变化"];
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
					<ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>
				),
				ol: ({ children }) => (
					<ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>
				),
				li: ({ children }) => <li className="leading-relaxed">{children}</li>,
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
				blockquote: ({ children }) => (
					<blockquote className="border-l-2 border-current/30 pl-3 italic opacity-80 my-2">
						{children}
					</blockquote>
				),
				a: ({ href, children }) => (
					<a
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						className="underline underline-offset-2 hover:opacity-80 text-primary"
					>
						{children}
					</a>
				),
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
		<div className="rounded-lg border border-violet-200/50 dark:border-violet-800/30 bg-violet-50/30 dark:bg-violet-950/20">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-[11px] text-violet-600 dark:text-violet-400 hover:bg-violet-100/40 dark:hover:bg-violet-900/20 transition-colors rounded-lg"
			>
				<BrainIcon className="size-3" />
				<span>思考过程</span>
				<ChevronDownIcon className={cn("size-3 ml-auto transition-transform", open && "rotate-180")} />
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

// ── 主组件 ───────────────────────────────────────────────

export function AgentPanel({ entityId, organizationId, className, onClose }: AgentPanelProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [input, setInput] = useState("");
	const pathname = usePathname();

	const { data: entity } = useQuery({
		...orpc.flowEntities.get.queryOptions({ input: { entityId: entityId ?? "" } }),
		enabled: !!entityId,
	});

	const entityCtx = entity
		? { id: entity.id, title: entity.title, type: entity.type, status: entity.status }
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
							extractedFields: entity.extractedFields as string | null,
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

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/agent/chat",
				body: () => ({ pageContext: pageContextRef.current }),
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	const { messages, sendMessage, status, setMessages, error } = useChat({ transport });
	const { pendingExecution, consumeExecution } = useAgent();

	const isLoading = status === "streaming" || status === "submitted";
	const hasError = status === "error";
	const hasMessages = messages.length > 0;

	useEffect(() => {
		setMessages([]);
		setInput("");
	}, [entityId, setMessages]);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
	}, [messages]);

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
			"事项：\"" + exec.entityTitle + "\" (ID: " + exec.entityId + ")",
			"建议工具：" + exec.actionTool,
			exec.actionParams && Object.keys(exec.actionParams).length > 0
				? "参数：" + JSON.stringify(exec.actionParams)
				: "",
			"",
			"请根据上下文自主判断需要执行哪些操作，不要只是描述，直接调用工具执行。",
		].filter(Boolean).join("\n");

		sendMessage({ text: instruction });
	}, [pendingExecution, isLoading, consumeExecution, sendMessage]);

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const text = input.trim();
		if (!text || isLoading) { return; }
		setInput("");
		sendMessage({ text });
	}

	function handleSuggestionClick(text: string) {
		if (isLoading) { return; }
		sendMessage({ text });
	}

	const suggestions = entity ? getSuggestions(entity.type, entity.status) : [];

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Header */}
			<div className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-border/50">
				<div className="flex items-center gap-2">
					<SparklesIcon className="size-4 text-violet-500" />
					<span className="text-sm font-semibold">Flowmail Agent</span>
					{isLoading && (
						<span className="text-[10px] text-muted-foreground flex items-center gap-1">
							<Spinner className="size-2.5" />
							思考中
						</span>
					)}
				</div>
				<div className="flex items-center gap-1">
					{hasMessages && (
						<Button
							variant="ghost"
							size="icon"
							className="size-7 text-muted-foreground hover:text-foreground"
							onClick={() => setMessages([])}
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

			{/* 当前 entity 上下文 */}
			{entity && (
				<div className="mx-3 mt-3 rounded-lg border bg-muted/20 px-3 py-2.5 shrink-0">
					<div className="flex items-center gap-1.5 mb-0.5">
						<Badge
							status={entity.type === "APPROVAL" ? "warning" : entity.type === "REPORT" ? "success" : "info"}
							className="h-4 rounded-sm px-1.5 text-[10px]"
						>
							{entity.type}
						</Badge>
						<Badge
							status={
								entity.status === "pending" ? "warning"
								: entity.status === "approved" || entity.status === "completed" ? "success"
								: entity.status === "rejected" ? "error"
								: "info"
							}
							className="h-4 rounded-sm px-1.5 text-[10px]"
						>
							{entity.status}
						</Badge>
						{entity.aiConfidence != null && (
							<span className="ml-auto text-[10px] text-muted-foreground">
								AI {Math.round(entity.aiConfidence * 100)}%
							</span>
						)}
					</div>
					<p className="text-xs font-medium truncate">{entity.title}</p>
				</div>
			)}

			{/* 消息列表 */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
				{!entityId && !hasMessages && (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 pb-8">
						<BotIcon className="size-10 mb-3" />
						<p className="text-xs text-center leading-relaxed">
							选择一个条目后，<br />Agent 将为你分析并提供操作建议
						</p>
					</div>
				)}

				{entityId && !hasMessages && (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 pb-8 gap-2">
						<SparklesIcon className="size-8 text-violet-300" />
						<p className="text-xs text-center">有什么我可以帮你的？</p>
					</div>
				)}

				{(messages as UIMessage[]).map((msg) => {
					if (msg.role === "user") {
						const userText = (msg.parts ?? [])
							.filter(isTextUIPart)
							.map((p) => p.text)
							.join("");
						return (
							<div key={msg.id} className="flex justify-end">
								<div className="max-w-[88%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2.5">
									<p className="text-sm leading-relaxed whitespace-pre-wrap">{userText}</p>
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
								if (tp.state === "output-available" || tp.state === "output-error") {
									completedToolCallIds.add(tp.toolCallId);
								}
							}
						}

						return (
							<div key={msg.id} className="flex justify-start">
								<div className="max-w-[92%] space-y-2">
									{parts.map((part, i) => {
										if (isReasoningUIPart(part)) {
											return part.text ? (
												<ReasoningToggle key={`${msg.id}-r-${i}`} text={part.text} />
											) : null;
										}

										if (isTextUIPart(part) && part.text) {
											return (
												<div key={`${msg.id}-t-${i}`} className="rounded-2xl rounded-bl-sm bg-muted/60 border px-3.5 py-2.5 text-sm text-foreground">
													<MarkdownContent content={part.text} />
												</div>
											);
										}

										if (isToolOrDynamicToolUIPart(part)) {
											const dynP = part as DynamicToolUIPart;
											const toolName = getToolOrDynamicToolName(part);

											if (dynP.state === "input-streaming" || dynP.state === "input-available") {
												if (completedToolCallIds.has(dynP.toolCallId)) {
													return null;
												}
												return (
													<div key={`${msg.id}-tool-${i}`} className="animate-in fade-in duration-200">
														<ToolSkeleton toolName={toolName} />
													</div>
												);
											}

											if (dynP.state === "output-error") {
												return (
													<div key={`${msg.id}-tool-${i}`} className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-center gap-1.5">
														<AlertTriangleIcon className="size-3 shrink-0" />
														{toolLabel(toolName)}失败
													</div>
												);
											}

											if (dynP.state === "output-available") {
												const output = dynP.output as Record<string, unknown>;
												const card = toolResultToBlock(toolName, output, entityCtx);
												if (card) {
													return (
														<div key={`${msg.id}-tool-${i}`} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
															<AgentCard card={card} />
														</div>
													);
												}
												return null;
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

				{isLoading && (messages as UIMessage[]).at(-1)?.role !== "assistant" && (
					<div className="flex items-center gap-2 text-muted-foreground px-1">
						<Spinner className="size-3.5" />
						<span className="text-xs">Agent 正在思考...</span>
					</div>
				)}

				{hasError && (
					<div className="mx-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
						<p className="text-xs text-destructive">
							⚠️ Agent 遇到错误{error?.message ? `：${error.message.slice(0, 80)}` : "，请重试"}
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
							className="text-[11px] px-2.5 py-1.5 rounded-full border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
						>
							{s}
						</button>
					))}
				</div>
			)}

			{/* 输入框 */}
			<form onSubmit={handleSubmit} className="px-3 pb-3 pt-1 shrink-0">
				<div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-violet-500/40 transition-all">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder={entity ? `问关于「${entity.title.slice(0, 12)}...」的问题` : "输入指令..."}
						className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
						disabled={isLoading}
					/>
					<button
						type="submit"
						disabled={!input.trim() || isLoading}
						className="text-muted-foreground hover:text-violet-600 disabled:opacity-30 transition-colors"
					>
						{isLoading ? <Spinner className="size-4" /> : <SendIcon className="size-4" />}
					</button>
				</div>
			</form>
		</div>
	);
}
