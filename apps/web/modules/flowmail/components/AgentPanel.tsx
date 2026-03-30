"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Spinner, cn } from "@repo/ui";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	BotIcon,
	CheckIcon,
	SendIcon,
	SparklesIcon,
	XIcon,
} from "lucide-react";
import { useRef, useState, useEffect, type FormEvent } from "react";

interface AgentPanelProps {
	entityId: string | null;
	className?: string;
	onClose?: () => void;
}

interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	toolCard?: {
		type: "approval_action" | "status_change" | "entity_info";
		data: Record<string, unknown>;
	};
}

export function AgentPanel({ entityId, className, onClose }: AgentPanelProps) {
	const queryClient = useQueryClient();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [isThinking, setIsThinking] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	const { data: entity } = useQuery({
		...orpc.flowEntities.get.queryOptions({
			input: { entityId: entityId ?? "" },
		}),
		enabled: !!entityId,
	});

	const approveMutation = useMutation(
		orpc.approvals.approve.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.get.key({ input: { entityId: entityId ?? "" } }) });
				queryClient.invalidateQueries({ queryKey: orpc.approvals.listPending.key() });
				addAssistantMessage("已批准 ✓", {
					type: "status_change",
					data: { from: "pending", to: "approved" },
				});
			},
		}),
	);

	const rejectMutation = useMutation(
		orpc.approvals.reject.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.get.key({ input: { entityId: entityId ?? "" } }) });
				queryClient.invalidateQueries({ queryKey: orpc.approvals.listPending.key() });
				addAssistantMessage("已拒绝 ✗", {
					type: "status_change",
					data: { from: "pending", to: "rejected" },
				});
			},
		}),
	);

	useEffect(() => {
		setMessages([]);
	}, [entityId]);

	useEffect(() => {
		if (entity && messages.length === 0) {
			const fields: Record<string, unknown> = entity.extractedFields
				? JSON.parse(entity.extractedFields as string)
				: {};
			const intro = buildEntityIntro(entity, fields);
			addAssistantMessage(intro, entity.type === "APPROVAL" ? {
				type: "entity_info",
				data: fields,
			} : undefined);
		}
	}, [entity]);

	function addAssistantMessage(content: string, toolCard?: ChatMessage["toolCard"]) {
		setMessages((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				role: "assistant",
				content,
				toolCard,
			},
		]);
	}

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!input.trim()) {
			return;
		}

		const userMsg: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content: input.trim(),
		};
		setMessages((prev) => [...prev, userMsg]);
		setInput("");
		handleUserCommand(userMsg.content);
	}

	function handleUserCommand(text: string) {
		const lower = text.toLowerCase();

		if (!entity) {
			addAssistantMessage("请先在左侧选择一个条目。");
			return;
		}

		if (
			entity.type === "APPROVAL" &&
			entity.status === "pending" &&
			(lower.includes("批准") || lower.includes("approve") || lower.includes("同意") || lower.includes("通过"))
		) {
			setIsThinking(true);
			const comment = text.replace(/批准|approve|同意|通过/gi, "").trim() || undefined;
			approveMutation.mutate(
				{ entityId: entity.id, comment },
				{ onSettled: () => setIsThinking(false) },
			);
			return;
		}

		if (
			entity.type === "APPROVAL" &&
			entity.status === "pending" &&
			(lower.includes("拒绝") || lower.includes("reject") || lower.includes("驳回"))
		) {
			setIsThinking(true);
			const reason = text.replace(/拒绝|reject|驳回/gi, "").trim() || "通过 Agent 拒绝";
			rejectMutation.mutate(
				{ entityId: entity.id, reason },
				{ onSettled: () => setIsThinking(false) },
			);
			return;
		}

		addAssistantMessage("目前我可以帮你处理审批操作（批准/拒绝）。更多能力正在开发中，你也可以通过 MCP 连接你自己的 Agent。");
	}

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
	}, [messages]);

	const isApprovalPending = entity?.type === "APPROVAL" && entity?.status === "pending";

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Header */}
			<div className="px-4 py-3 flex items-center justify-between shrink-0">
				<div className="flex items-center gap-2">
					<SparklesIcon className="size-4 text-primary" />
					<span className="text-sm font-medium">Flowmail Agent</span>
				</div>
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

			{/* Context card */}
			{entity && (
				<div className="mx-3 mt-3 rounded-lg border bg-muted/30 p-3 shrink-0">
					<div className="flex items-center gap-1.5 mb-1">
						<Badge status="info" className="text-[10px] px-1.5 py-0">{entity.type}</Badge>
						<Badge status={entity.status === "pending" ? "warning" : entity.status === "approved" ? "success" : "info"} className="text-[10px] px-1.5 py-0">
							{entity.status}
						</Badge>
						{entity.aiConfidence != null && (
							<span className="text-[10px] text-muted-foreground ml-auto">
								{Math.round(entity.aiConfidence * 100)}%
							</span>
						)}
					</div>
					<p className="text-sm font-medium truncate">{entity.title}</p>
				</div>
			)}

			{/* Messages */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
				{!entityId && (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
						<BotIcon className="size-8 mb-2" />
						<p className="text-xs text-center">选择一个条目后，<br />Agent 将为你分析并提供操作建议</p>
					</div>
				)}

				{messages.map((msg) => (
					<div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
						<div
							className={cn(
								"max-w-[90%] rounded-lg px-3 py-2 text-sm",
								msg.role === "user"
									? "bg-primary text-primary-foreground"
									: "bg-muted/60 border",
							)}
						>
							<p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

							{/* Tool card: approval action buttons */}
							{msg.toolCard?.type === "entity_info" && isApprovalPending && (
								<div className="mt-2 flex gap-2">
									<Button
										size="sm"
										className="h-7 text-xs"
										disabled={approveMutation.isPending || rejectMutation.isPending}
										onClick={() => {
											setIsThinking(true);
											approveMutation.mutate(
												{ entityId: entity!.id },
												{ onSettled: () => setIsThinking(false) },
											);
										}}
									>
										<CheckIcon className="size-3 mr-1" />
										批准
									</Button>
									<Button
										size="sm"
										variant="destructive"
										className="h-7 text-xs"
										disabled={approveMutation.isPending || rejectMutation.isPending}
										onClick={() => {
											setIsThinking(true);
											rejectMutation.mutate(
												{ entityId: entity!.id, reason: "Rejected via Agent" },
												{ onSettled: () => setIsThinking(false) },
											);
										}}
									>
										<XIcon className="size-3 mr-1" />
										拒绝
									</Button>
								</div>
							)}

							{/* Tool card: status change */}
							{msg.toolCard?.type === "status_change" && (
								<div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
									<span className="line-through">{String(msg.toolCard.data.from)}</span>
									<span>→</span>
									<Badge
										status={msg.toolCard.data.to === "approved" ? "success" : "error"}
										className="text-[10px] px-1 py-0"
									>
										{String(msg.toolCard.data.to)}
									</Badge>
								</div>
							)}
						</div>
					</div>
				))}

				{isThinking && (
					<div className="flex items-center gap-2 text-muted-foreground">
						<Spinner className="size-3" />
						<span className="text-xs">处理中...</span>
					</div>
				)}
			</div>

			{/* Quick actions */}
			{entity && isApprovalPending && messages.length <= 1 && (
				<div className="px-3 pb-2 flex gap-1.5 flex-wrap shrink-0">
					{["批准这个审批", "拒绝，预算不足"].map((suggestion) => (
						<button
							key={suggestion}
							type="button"
							onClick={() => {
								setInput(suggestion);
							}}
							className="text-[11px] px-2.5 py-1 rounded-full border text-muted-foreground hover:bg-muted/50 transition-colors"
						>
							{suggestion}
						</button>
					))}
				</div>
			)}

			{/* Input */}
			<form onSubmit={handleSubmit} className="px-3 pb-3 pt-1 shrink-0">
				<div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 focus-within:ring-1 focus-within:ring-primary/50">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="输入指令..."
						className="flex-1 bg-transparent text-sm outline-none"
					/>
					<button
						type="submit"
						disabled={!input.trim()}
						className="text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors"
					>
						<SendIcon className="size-4" />
					</button>
				</div>
			</form>
		</div>
	);
}

function buildEntityIntro(entity: { type: string; title: string; aiSummary?: string | null }, fields: Record<string, unknown>): string {
	const parts: string[] = [];

	if (entity.type === "APPROVAL") {
		parts.push(`这是一条审批请求：「${entity.title}」`);
		if (fields.amount) {
			parts.push(`金额：${fields.currency ?? ""}${fields.amount}`);
		}
		if (fields.deadline) {
			parts.push(`截止：${fields.deadline}`);
		}
		if (fields.urgency && fields.urgency !== "normal") {
			parts.push(`紧急度：${fields.urgency}`);
		}
		parts.push("\n你可以直接说「批准」或「拒绝」来处理。");
	} else if (entity.type === "REPORT") {
		parts.push(`这是一份汇报：「${entity.title}」`);
		if (fields.overallStatus) {
			parts.push(`整体状态：${fields.overallStatus}`);
		}
		if (entity.aiSummary) {
			parts.push(`\n摘要：${entity.aiSummary}`);
		}
	} else {
		parts.push(`「${entity.title}」— ${entity.type}`);
		if (entity.aiSummary) {
			parts.push(`\n${entity.aiSummary}`);
		}
	}

	return parts.join("\n");
}
