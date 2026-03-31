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
	BotIcon,
	BrainIcon,
	ChevronDownIcon,
	SendIcon,
	SparklesIcon,
	XIcon,
	RefreshCwIcon,
	LightbulbIcon,
} from "lucide-react";
import { useEffect, useRef, useState, useMemo, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { AgentCard } from "../agent/AgentCards";
import { buildPageContext } from "../agent/build-page-context";
import type { AgentBlock, AgentUICard } from "../agent/types";
import { useAgent } from "./AgentProvider";

interface AgentPanelProps {
	entityId: string | null;
	organizationId?: string;
	className?: string;
	onClose?: () => void;
}

// ── Blocks 解析 ──────────────────────────────────────────

/**
 * 从 AI 原始文本中提取有序 blocks。
 * AI 输出格式：普通文本 + <ui_block>{...}</ui_block> 标签穿插。
 * 最终输出一个 AgentBlock[] 数组，前端按顺序渲染。
 */
function parseBlocks(text: string): AgentBlock[] {
	const blocks: AgentBlock[] = [];
	const parts = text.split(/(<ui_block>[\s\S]*?<\/ui_block>)/g);

	for (const part of parts) {
		const match = part.match(/^<ui_block>([\s\S]*?)<\/ui_block>$/);
		if (match) {
			try {
				const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>;
				const blockType = parsed.type as string;

			if (blockType === "suggestions" && Array.isArray(parsed.items)) {
				blocks.push({ type: "suggestions", items: parsed.items as string[] });
			} else if (["approval_card", "report_card", "risk_card", "timeline_diff", "entity_list", "action_confirm", "action_result"].includes(blockType)) {
				const { type: _type, ...rest } = parsed;
				const cardData = parsed.data ?? rest;
				blocks.push({ type: blockType, data: cardData } as AgentBlock);
			}
			} catch {
				// ignore malformed JSON
			}
		} else {
			const trimmed = part.trim();
			if (trimmed) {
				blocks.push({ type: "text", content: trimmed });
			}
		}
	}

	return blocks;
}

function toolResultToText(toolName: string, result: Record<string, unknown>): string {
	if (result.error) {
		return `⚠️ 操作失败：${result.error}`;
	}
	switch (toolName) {
		case "get_entity": {
			const title = result.title ?? "未知";
			const type = result.type ?? "";
			const status = result.status ?? "";
			const summary = result.aiSummary ?? "";
			const fields = result.extractedFields as Record<string, unknown> | undefined;
			const lines = [`📋 **${title}**（${type} · ${status}）`];
			if (summary) {
				lines.push(String(summary));
			}
			if (fields && typeof fields === "object") {
				const fieldParts = Object.entries(fields)
					.slice(0, 5)
					.map(([k, v]) => `${k}: ${v}`)
					.join("  |  ");
				if (fieldParts) {
					lines.push(fieldParts);
				}
			}
			const eventCount = result.timelineCount;
			if (eventCount) {
				lines.push(`共 ${eventCount} 条时间线事件`);
			}
			return lines.join("\n");
		}
		case "approve_entity":
			return `✅ 已批准「${result.title ?? "审批请求"}」`;
		case "reject_entity":
			return `❌ 已拒绝「${result.title ?? "审批请求"}」`;
		case "predict_risk": {
			const level = result.riskLevel ?? "unknown";
			const factors = (result.riskFactors as string[]) ?? [];
			const lines = [`🔍 风险等级：**${level}**`];
			if (factors.length > 0) {
				lines.push("风险因素：" + factors.slice(0, 3).join("、"));
			}
			if (result.predictedOutcome) {
				lines.push("预期结果：" + String(result.predictedOutcome));
			}
			return lines.join("\n");
		}
		case "get_timeline_diff": {
			const lines = [`📊 ${result.summary ?? "时间线变化分析完成"}`];
			if (result.progressDelta != null) {
				const delta = Number(result.progressDelta);
				lines.push(`进度变化：${delta > 0 ? "+" : ""}${delta}%`);
			}
			const risks = (result.riskSignals as string[]) ?? [];
			if (risks.length > 0) {
				lines.push("⚠️ " + risks.slice(0, 3).join("、"));
			}
			if (result.recommendation) {
				lines.push("建议：" + String(result.recommendation));
			}
			return lines.join("\n");
		}
		case "add_note":
			return `✅ 已添加${result.type === "milestone" ? "里程碑" : "备注"}：${result.content ?? ""}`;
		case "update_entity_status":
			return `✅ 状态已变更：${result.fromStatus} → ${result.toStatus}`;
		case "list_pending_approvals": {
			const count = result.count ?? 0;
			const items = (result.items as Array<{ title: string; status: string }>) ?? [];
			if (items.length === 0) {
				return "📭 目前没有待审批事项";
			}
			const itemLines = items.slice(0, 5).map((it) => `• ${it.title}`).join("\n");
			return `📬 共 ${count} 条待审批事项\n${itemLines}`;
		}
		default:
			return "操作完成";
	}
}

/** Tool 结果 → UI 卡片 block */
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

function BlockRenderer({ block, onSuggestionClick }: { block: AgentBlock; onSuggestionClick?: (text: string) => void }) {
	if (block.type === "text") {
		return (
			<div className="rounded-2xl rounded-bl-sm bg-muted/60 border px-3.5 py-2.5">
				<p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
					{block.content}
				</p>
			</div>
		);
	}

	if (block.type === "suggestions") {
		return (
			<div className="flex gap-1.5 flex-wrap">
				{block.items.map((s) => (
					<button
						key={s}
						type="button"
						onClick={() => onSuggestionClick?.(s)}
						className="text-[11px] px-2.5 py-1.5 rounded-full border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors flex items-center gap-1"
					>
						<LightbulbIcon className="size-3 text-amber-500" />
						{s}
					</button>
				))}
			</div>
		);
	}

	return <AgentCard card={block as AgentUICard} />;
}

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

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/agent/chat",
				body: { pageContext },
			}),
		[pageContext],
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
						const textParts = (msg.parts ?? []).filter(isTextUIPart);
						const reasoningParts = (msg.parts ?? []).filter(isReasoningUIPart);
						const toolParts = (msg.parts ?? []).filter(isToolOrDynamicToolUIPart);

						const reasoningText = reasoningParts.map((p) => p.reasoning).join("");

						const rawText = textParts.map((p) => p.text).join("");

						// 从 AI 文本中提取有序 blocks
						const textBlocks = parseBlocks(rawText);

						// 从 Tool Results 中提取卡片 blocks + 自动文本
						const completedTools: Array<{ name: string; output: Record<string, unknown> }> = [];
						const toolBlocks: AgentBlock[] = toolParts.flatMap((p) => {
							const dynP = p as DynamicToolUIPart;
							if (dynP.state === "error") {
								completedTools.push({ name: getToolOrDynamicToolName(p), output: { error: "工具执行出错" } });
								return [];
							}
							if (dynP.state !== "output-available") { return []; }
							const toolName = getToolOrDynamicToolName(p);
							const output = dynP.output as Record<string, unknown>;
							completedTools.push({ name: toolName, output });
							const card = toolResultToBlock(toolName, output, entityCtx);
							return card ? [card] : [];
						});

						const hasPendingTool = toolParts.some((p) => {
							const dynP = p as DynamicToolUIPart;
							return dynP.state === "input-streaming" || dynP.state === "input-available";
						});

						// 合并：tool 卡片插在文本 blocks 和 suggestions 之间
						const allBlocks: AgentBlock[] = [];
						const suggestionBlocks: AgentBlock[] = [];
						for (const b of textBlocks) {
							if (b.type === "suggestions") {
								suggestionBlocks.push(b);
							} else {
								allBlocks.push(b);
							}
						}

						const hasRealText = allBlocks.some((b) => b.type === "text");
						if (!hasRealText && completedTools.length > 0) {
							const autoText = completedTools
								.map((t) => toolResultToText(t.name, t.output))
								.join("\n\n");
							allBlocks.unshift({ type: "text", content: autoText });
						}

						allBlocks.push(...toolBlocks, ...suggestionBlocks);

						return (
							<div key={msg.id} className="flex justify-start">
								<div className="max-w-[92%] space-y-2">
									{reasoningText && (
										<ReasoningToggle text={reasoningText} />
									)}

									{hasPendingTool && (
										<div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
											<Spinner className="size-3" />
											<span>正在调用工具...</span>
										</div>
									)}

									{allBlocks.map((block, i) => (
										<BlockRenderer
											key={i}
											block={block}
											onSuggestionClick={handleSuggestionClick}
										/>
									))}
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
