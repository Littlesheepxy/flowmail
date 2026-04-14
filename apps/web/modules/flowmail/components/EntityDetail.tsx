"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Spinner } from "@repo/ui";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeftIcon,
	CheckCircle2Icon,
	ClockIcon,
	AlertCircleIcon,
	XCircleIcon,
	InboxIcon,
	MailIcon,
	BotIcon,
	CheckIcon,
	XIcon,
	ShieldAlertIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	Reply as ReplyIcon,
	ForwardIcon,
	SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { EntityTimeline } from "./EntityTimeline";
import type { ReplyMode } from "./ReplyComposer";
import { ReplyComposer } from "./ReplyComposer";

const statusConfig: Record<
	string,
	{ badgeStatus: "success" | "info" | "warning" | "error"; icon: typeof ClockIcon }
> = {
	pending: { badgeStatus: "warning", icon: ClockIcon },
	approved: { badgeStatus: "success", icon: CheckCircle2Icon },
	rejected: { badgeStatus: "error", icon: XCircleIcon },
	in_progress: { badgeStatus: "info", icon: ClockIcon },
	completed: { badgeStatus: "success", icon: CheckCircle2Icon },
	blocked: { badgeStatus: "error", icon: AlertCircleIcon },
	open: { badgeStatus: "warning", icon: AlertCircleIcon },
	received: { badgeStatus: "info", icon: InboxIcon },
};

const RISK_COLORS: Record<string, string> = {
	low: "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
	medium: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400",
	high: "text-orange-600 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400",
	critical: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
};

function FieldGrid({ fields }: { fields: Record<string, unknown> }) {
	const entries = Object.entries(fields).filter(
		([_, v]) => v !== null && v !== undefined && v !== "",
	);
	if (entries.length === 0) { return null; }

	return (
		<div className="grid grid-cols-2 gap-3 text-sm">
			{entries.map(([key, value]) => (
				<div key={key} className="space-y-0.5">
					<dt className="text-muted-foreground capitalize">
						{key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
					</dt>
					<dd className="font-medium">{String(value)}</dd>
				</div>
			))}
		</div>
	);
}

function RiskPanel({ entityId }: { entityId: string }) {
	const [expanded, setExpanded] = useState(false);

	const { data: risk, isLoading } = useQuery({
		...orpc.flowEntities.predictRisk.queryOptions({
			input: { entityId },
		}),
		enabled: expanded,
	});

	return (
		<Card className="p-4">
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="flex w-full items-center justify-between"
			>
				<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
					<ShieldAlertIcon className="size-4" />
					AI 风险预测
				</div>
				{expanded ? (
					<ChevronUpIcon className="size-4 text-muted-foreground" />
				) : (
					<ChevronDownIcon className="size-4 text-muted-foreground" />
				)}
			</button>

			{expanded && (
				<div className="mt-4">
					{isLoading ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Spinner className="size-4" />
							正在分析风险...
						</div>
					) : risk ? (
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<span
									className={`rounded-md px-2.5 py-1 text-sm font-semibold ${RISK_COLORS[risk.riskLevel] ?? RISK_COLORS.low}`}
								>
									{risk.riskLevel === "low"
										? "低风险"
										: risk.riskLevel === "medium"
											? "中风险"
											: risk.riskLevel === "high"
												? "高风险"
												: "严重风险"}
								</span>
								<span className="text-xs text-muted-foreground">
									置信度 {Math.round(risk.confidence * 100)}%
								</span>
							</div>

							{risk.deadlineRisk.hasDeadline && (
								<div className="text-sm">
									<span className="text-muted-foreground">截止日期：</span>
									<span
										className={`font-medium ${risk.deadlineRisk.isAtRisk ? "text-red-600 dark:text-red-400" : ""}`}
									>
										{risk.deadlineRisk.deadline}
										{risk.deadlineRisk.daysRemaining != null && (
											<span className="ml-1 text-xs">
												（剩余 {risk.deadlineRisk.daysRemaining} 天）
											</span>
										)}
									</span>
								</div>
							)}

							{risk.riskFactors.length > 0 && (
								<div>
									<p className="mb-1.5 text-xs font-medium text-muted-foreground">
										风险因素
									</p>
									<ul className="space-y-1">
										{risk.riskFactors.map((f) => (
											<li
												key={f}
												className="flex items-start gap-1.5 text-xs"
											>
												<AlertCircleIcon className="mt-0.5 size-3 shrink-0 text-orange-500" />
												{f}
											</li>
										))}
									</ul>
								</div>
							)}

							{risk.predictedOutcome && (
								<p className="text-sm text-muted-foreground">
									<span className="font-medium text-foreground">预测：</span>
									{risk.predictedOutcome}
								</p>
							)}

							{risk.suggestedActions.length > 0 && (
								<div>
									<p className="mb-1.5 text-xs font-medium text-muted-foreground">
										建议操作
									</p>
									<ul className="space-y-1">
										{risk.suggestedActions.map((a) => (
											<li
												key={a}
												className="flex items-start gap-1.5 text-xs"
											>
												<CheckIcon className="mt-0.5 size-3 shrink-0 text-green-500" />
												{a}
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
					) : null}
				</div>
			)}
		</Card>
	);
}

export function EntityDetail() {
	const params = useParams();
	const pathname = usePathname();
	const queryClient = useQueryClient();
	const entityId = params.entityId as string;

	const backPath = pathname.split("/").slice(0, -1).join("/");

	const { data: entity, isLoading } = useQuery({
		...orpc.flowEntities.get.queryOptions({
			input: { entityId },
		}),
		refetchInterval: 5000,
	});

	const approveMutation = useMutation(
		orpc.approvals.approve.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.key({ input: { entityId } }),
				});
			},
		}),
	);

	const rejectMutation = useMutation(
		orpc.approvals.reject.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.key({ input: { entityId } }),
				});
			},
		}),
	);

	const sendMutation = useMutation(
		orpc.emailConnections.sendEmail.mutationOptions(),
	);

	const enrichMutation = useMutation(
		orpc.flowEntities.enrich.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.key({ input: { entityId } }),
				});
				toast.success("AI 分析完成");
			},
			onError: (err) => {
				toast.error(`AI 分析失败: ${err.message}`);
			},
		}),
	);

	const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
	const [replyMode, setReplyMode] = useState<ReplyMode>("reply");

	const openReply = useCallback((threadId: string, mode: ReplyMode) => {
		setReplyThreadId(threadId);
		setReplyMode(mode);
	}, []);

	const handleSend = useCallback(
		async (data: { mode: ReplyMode; html: string; text: string }) => {
			if (!entity) {
				return;
			}
			const thread = entity.threads?.find((t) => t.id === replyThreadId);
			if (!thread) {
				return;
			}

			const connectionId = (thread as { connectionId?: string }).connectionId;
			if (!connectionId) {
				toast.error("找不到邮箱连接，无法发送");
				return;
			}

			const senderEmail = thread.sender ?? "";
			let to: string[];
			let cc: string[] | undefined;

			const parseRecips = (raw?: string | null): Array<{ name?: string; address: string }> => {
				if (!raw) {
					return [];
				}
				try {
					return JSON.parse(raw) as Array<{ name?: string; address: string }>;
				} catch {
					return [];
				}
			};

			const toRecipients = parseRecips(thread.toRecipients);
			const ccRecipients = parseRecips(thread.ccRecipients);

			if (data.mode === "reply") {
				to = [senderEmail];
			} else if (data.mode === "replyAll") {
				to = [senderEmail, ...toRecipients.map((r) => r.address)];
				cc = ccRecipients.map((r) => r.address);
			} else {
				to = [];
			}

			to = [...new Set(to.filter(Boolean))];
			if (cc) {
				cc = [...new Set(cc.filter(Boolean))];
			}

			const subjectPrefix = data.mode === "forward" ? "Fwd: " : "Re: ";
			const rawSubject = thread.subject ?? "";
			const subject =
				rawSubject.startsWith("Re:") || rawSubject.startsWith("Fwd:")
					? rawSubject
					: `${subjectPrefix}${rawSubject}`;

			const messageId = (thread as { messageId?: string | null }).messageId;

			try {
				await sendMutation.mutateAsync({
					connectionId,
					to,
					cc,
					subject,
					htmlBody: data.html,
					textBody: data.text,
					inReplyTo: messageId ?? undefined,
				});

				toast.success("邮件已发送");
				setReplyThreadId(null);

				await queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.key({ input: { entityId } }),
				});
			} catch (err) {
				toast.error(
					`发送失败: ${err instanceof Error ? err.message : "未知错误"}`,
				);
			}
		},
		[entity, replyThreadId, sendMutation, queryClient, entityId],
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Spinner className="size-6 text-primary" />
			</div>
		);
	}

	if (!entity) {
		return (
			<div className="py-20 text-center text-muted-foreground">
				Entity not found
			</div>
		);
	}

	const fields: Record<string, unknown> = entity.extractedFields
		? JSON.parse(entity.extractedFields as string)
		: {};

	const statusCfg = statusConfig[entity.status] ?? statusConfig.pending;
	const StatusIcon = statusCfg.icon;
	const isApproval = entity.type === "APPROVAL";
	const isPending = entity.status === "pending";
	const actionPending = approveMutation.isPending || rejectMutation.isPending;

	return (
		<div data-module="entity-detail" className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-3">
				<Link href={backPath}>
					<Button variant="ghost" size="icon">
						<ArrowLeftIcon className="size-4" />
					</Button>
				</Link>
				<div className="flex-1">
					<h2 className="text-xl font-semibold">{entity.title}</h2>
					<div className="mt-1 flex items-center gap-2 flex-wrap">
						<Badge status={statusCfg.badgeStatus} className="gap-1">
							<StatusIcon className="size-3" />
							{entity.status}
						</Badge>
						<Badge status="info">{entity.type}</Badge>
						{entity.category && (
							<Badge className="gap-1" style={{ backgroundColor: `${entity.category.color}20`, color: entity.category.color, borderColor: `${entity.category.color}40` }}>
								{entity.category.name}
							</Badge>
						)}
						{entity.aiConfidence != null && (
							<span className="text-xs text-muted-foreground">
								{Math.round(entity.aiConfidence * 100)}% AI 置信度
							</span>
						)}
					</div>
				</div>

				<div className="flex gap-2">
					<Button
						variant={entity.aiSummary ? "outline" : "default"}
						disabled={enrichMutation.isPending}
						onClick={() => enrichMutation.mutate({ entityId })}
					>
						{enrichMutation.isPending ? (
							<Spinner className="mr-1 size-4" />
						) : (
							<SparklesIcon className="mr-1 size-4" />
						)}
						{entity.aiSummary ? "重新分析" : "AI 分析"}
					</Button>
					{isApproval && isPending && (
						<>
							<Button
								disabled={actionPending}
								onClick={() => approveMutation.mutate({ entityId })}
							>
								<CheckIcon className="mr-1 size-4" />
								批准
							</Button>
							<Button
								variant="destructive"
								disabled={actionPending}
								onClick={() =>
									rejectMutation.mutate({
										entityId,
										reason: "Rejected via detail page",
									})
								}
							>
								<XIcon className="mr-1 size-4" />
								拒绝
							</Button>
						</>
					)}
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main content — left 2/3 */}
				<div className="space-y-6 lg:col-span-2">
					{entity.aiSummary && (
						<Card className="p-4">
							<div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<BotIcon className="size-4" />
								AI 摘要
							</div>
							<p className="text-sm leading-relaxed">{entity.aiSummary}</p>
						</Card>
					)}

					{Object.keys(fields).length > 0 && (
						<Card className="p-4">
							<h3 className="mb-3 text-sm font-medium text-muted-foreground">
								提取字段
							</h3>
							<FieldGrid fields={fields} />
						</Card>
					)}

					{/* Email threads */}
					{entity.threads && entity.threads.length > 0 && (
						<Card className="p-4">
							<h3 className="mb-3 text-sm font-medium text-muted-foreground">
								关联邮件（{entity.threads.length}）
							</h3>
							<div className="space-y-3">
								{entity.threads.map((thread) => (
									<div key={thread.id}>
										<div className="flex items-start gap-3 rounded-md border p-3">
											<MailIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium truncate">{thread.subject}</p>
												<p className="text-xs text-muted-foreground">
													From: {thread.sender} &middot;{" "}
													{new Date(thread.receivedAt).toLocaleString("zh-CN")}
												</p>
												{thread.snippet && (
													<p className="mt-1 text-xs text-muted-foreground line-clamp-2">
														{thread.snippet}
													</p>
												)}
												<div className="mt-2 flex items-center gap-1.5">
													<Button
														variant="secondary"
														size="sm"
														className="h-6 px-2 gap-1 text-xs"
														onClick={() => openReply(thread.id, "reply")}
													>
														<ReplyIcon className="size-3" />
														回复
													</Button>
													<Button
														variant="secondary"
														size="sm"
														className="h-6 px-2 gap-1 text-xs"
														onClick={() => openReply(thread.id, "forward")}
													>
														<ForwardIcon className="size-3" />
														转发
													</Button>
												</div>
											</div>
										</div>

										{replyThreadId === thread.id && (
											<div className="mt-2 rounded-md border overflow-hidden">
												<ReplyComposer
													senderName={thread.senderName ?? undefined}
													senderEmail={thread.sender ?? ""}
													subject={thread.subject ?? ""}
													defaultMode={replyMode}
													onSend={handleSend}
													onClose={() => setReplyThreadId(null)}
													isSending={sendMutation.isPending}
												/>
											</div>
										)}
									</div>
								))}
							</div>
						</Card>
					)}

					{/* Risk prediction — expandable */}
					<RiskPanel entityId={entityId} />
				</div>

				{/* Timeline sidebar — right 1/3 */}
				<div>
					<Card className="p-4">
						<EntityTimeline
							entityId={entityId}
							entityTitle={entity.title}
							events={(entity.timeline ?? []).map((e) => ({
								...e,
								createdAt: e.createdAt.toString(),
								actor: e.actor
									? { id: e.actor.id, name: e.actor.name ?? "", image: e.actor.image }
									: null,
							}))}
							entityType={entity.type}
							status={entity.status}
							extractedFields={entity.extractedFields as string | null}
						/>
					</Card>
				</div>
			</div>
		</div>
	);
}
