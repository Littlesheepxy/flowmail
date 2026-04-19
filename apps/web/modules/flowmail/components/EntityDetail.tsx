"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { Spinner } from "@repo/ui";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAgent } from "./AgentProvider";
import { ViewRenderer, aggregateAutoTodos, TodoListBlock } from "./view-blocks";
import type { ViewBlock, ViewSpec } from "@repo/api";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
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
	Trash2Icon,
	PlusIcon,
	LayoutDashboardIcon,
	CheckSquareIcon,
	AlertTriangleIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { getEntityTypeBadgeStatus, getEntityTypeLabel, getStatusLabel } from "../lib/entity-type-config";
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
		staleTime: 30_000,
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

	const deleteMutation = useMutation(
		orpc.flowEntities.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.list.key() });
				toast.success("已删除");
				window.history.back();
			},
			onError: (err) => {
				toast.error(`删除失败：${err.message}`);
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
						{entity.aiSummary ? (
							<>
								<Badge status={statusCfg.badgeStatus} className="gap-1">
									<StatusIcon className="size-3" />
									{getStatusLabel(entity.status)}
								</Badge>
								<Badge status={getEntityTypeBadgeStatus(entity.type)}>{getEntityTypeLabel(entity.type)}</Badge>
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
							</>
						) : (
							<Badge status="info">待 AI 分析</Badge>
						)}
					</div>
				</div>

				<div className="flex gap-2">
					<Button
						variant={entity.aiSummary ? "outline" : "primary"}
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

					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="outline" size="icon" disabled={deleteMutation.isPending}>
								{deleteMutation.isPending ? (
									<Spinner className="size-4" />
								) : (
									<Trash2Icon className="size-4 text-destructive" />
								)}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>确认删除</AlertDialogTitle>
								<AlertDialogDescription>
									将永久删除「{entity.title}」及其所有邮件和附件，此操作不可撤销。
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>取消</AlertDialogCancel>
								<AlertDialogAction
									onClick={() => deleteMutation.mutate({ entityId })}
									className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								>
									确认删除
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
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

			<MultiProjectBanner entityId={entityId} fields={fields} />

			<EntityTabs
				entityId={entityId}
				entity={entity}
				fields={fields}
				replyThreadId={replyThreadId}
				replyMode={replyMode}
				openReply={openReply}
				handleSend={handleSend}
				setReplyThreadId={setReplyThreadId}
				isSending={sendMutation.isPending}
			/>
		</div>
	);
}

interface SubProjectCandidate {
	title: string;
	summary: string;
	keywords?: string[];
}

function MultiProjectBanner({
	entityId,
	fields,
}: {
	entityId: string;
	fields: Record<string, unknown>;
}) {
	const { triggerAgentPrompt } = useAgent();
	const subProjects = (fields.subProjects as SubProjectCandidate[] | undefined) ?? [];
	const decision = fields.subProjectsDecision as string | null | undefined;

	if (!subProjects.length || decision) {
		return null;
	}

	const titles = subProjects.map((p) => p.title).join(" / ");

	function ask() {
		const prompt = `当前 entity (id=${entityId}) 检测到 ${subProjects.length} 个独立子项目：${subProjects
			.map((p, i) => `\n${i + 1}. ${p.title} — ${p.summary}`)
			.join("")}\n\n请帮我决定如何处理：是「拆成多个独立 entity 分别追踪」，还是「保持合并、只在视图里分组」，还是「只关心其中某一个」？给出建议并按我的回复执行。`;
		triggerAgentPrompt({
			text: prompt,
			entityId,
		});
	}

	return (
		<div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 dark:border-amber-700/50 dark:bg-amber-950/20">
			<div className="flex items-start gap-3">
				<AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
				<div className="flex-1 min-w-0">
					<div className="font-medium text-sm text-amber-900 dark:text-amber-200">
						AI 检测到 {subProjects.length} 个独立子项目
					</div>
					<div className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80 line-clamp-2">
						{titles}
					</div>
				</div>
				<Button size="sm" variant="outline" onClick={ask}>
					让 Agent 处理
				</Button>
			</div>
		</div>
	);
}

// entity 来自 useQuery，复杂泛型推断不稳定，这里用 any 简化（仅 prop 传递用，渲染逻辑不依赖具体类型）
type AnyEntity = any;

interface EntityTabsProps {
	entityId: string;
	entity: AnyEntity;
	fields: Record<string, unknown>;
	replyThreadId: string | null;
	replyMode: ReplyMode;
	openReply: (threadId: string, mode: ReplyMode) => void;
	handleSend: (data: { mode: ReplyMode; html: string; text: string }) => Promise<void>;
	setReplyThreadId: (id: string | null) => void;
	isSending: boolean;
}

function EntityTabs(props: EntityTabsProps) {
	const {
		entityId,
		entity,
		fields,
		replyThreadId,
		replyMode,
		openReply,
		handleSend,
		setReplyThreadId,
		isSending,
	} = props;

	const queryClient = useQueryClient();
	const { triggerAgentPrompt } = useAgent();

	const { data: customViews = [] } = useQuery({
		...orpc.entityViews.list.queryOptions({ input: { entityId } }),
	});

	const [activeTab, setActiveTab] = useState<string>("timeline");

	const deleteViewMutation = useMutation(
		orpc.entityViews.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.entityViews.list.key({ input: { entityId } }),
				});
				setActiveTab("timeline");
				toast.success("已删除视图");
			},
			onError: (err) => {
				toast.error(`删除失败：${err.message}`);
			},
		}),
	);

	const todoCount = useMemo(() => {
		const items = aggregateAutoTodos({
			id: entity.id,
			extractedFields: entity.extractedFields as string | null,
			timeline: entity.timeline ?? undefined,
		});
		return items.filter((i) => i.status !== "completed").length;
	}, [entity]);

	function handleNewView() {
		triggerAgentPrompt({
			text: `请为「${entity.title}」(ID: ${entityId}) 创建一个自定义视图。先调用 list_view_components 看看可用的积木类型，然后根据这个事项的特点（类别、邮件类型、当前阶段）拼出一个有用的视图，例如月度汇报视图、Todo 视图、关键指标视图等。完成后调用 create_view 工具保存。`,
			entityId,
		});
	}

	const timelineEvents = (entity.timeline ?? []).map((e: any) => ({
		...e,
		createdAt: e.createdAt.toString(),
		actor: e.actor
			? { id: e.actor.id, name: e.actor.name ?? "", image: e.actor.image }
			: null,
	}));

	return (
		<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
			<TabsList className="w-full justify-start overflow-x-auto">
				<TabsTrigger value="timeline" className="gap-1.5">
					<ClockIcon className="size-3.5" />
					时间线
				</TabsTrigger>
				<TabsTrigger value="todo" className="gap-1.5">
					<CheckSquareIcon className="size-3.5" />
					Todo
					{todoCount > 0 && (
						<span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground leading-none">
							{todoCount}
						</span>
					)}
				</TabsTrigger>
				{customViews.map((v) => (
					<TabsTrigger key={v.id} value={v.id} className="gap-1.5">
						<LayoutDashboardIcon className="size-3.5" />
						{v.title}
						{v.categoryId && !v.entityId && (
							<span className="ml-1 text-[9px] text-muted-foreground uppercase">模板</span>
						)}
					</TabsTrigger>
				))}
				<button
					type="button"
					onClick={handleNewView}
					className="-mb-0.5 inline-flex items-center justify-center whitespace-nowrap border-transparent border-b-2 px-3 py-2 font-medium text-foreground/40 text-sm hover:text-foreground/80 transition-colors"
					title="让 Agent 创建自定义视图"
				>
					<PlusIcon className="size-3.5 mr-1" />
					新视图
				</button>
			</TabsList>

			<TabsContent value="timeline" className="mt-4">
				<div className="grid gap-6 lg:grid-cols-3">
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

						{entity.threads && entity.threads.length > 0 && (
							<Card className="p-4">
								<h3 className="mb-3 text-sm font-medium text-muted-foreground">
									关联邮件（{entity.threads.length}）
								</h3>
								<div className="space-y-3">
									{entity.threads.map((thread: any) => (
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
														isSending={isSending}
													/>
												</div>
											)}
										</div>
									))}
								</div>
							</Card>
						)}

						<RiskPanel entityId={entityId} />
					</div>

					<div>
						<Card className="p-4">
							<EntityTimeline
								entityId={entityId}
								entityTitle={entity.title}
								events={timelineEvents}
								entityType={entity.type}
								status={entity.status}
								extractedFields={entity.extractedFields as string | null}
							/>
						</Card>
					</div>
				</div>
			</TabsContent>

			<TabsContent value="todo" className="mt-4">
				<TodoListBlock
					block={{
						type: "todo_list",
						title: "待办与阻塞（自动聚合）",
						source: "auto",
						groupBy: "status",
					}}
					entityId={entityId}
					autoItems={aggregateAutoTodos({
						id: entity.id,
						extractedFields: entity.extractedFields as string | null,
						timeline: entity.timeline ?? undefined,
					})}
				/>
			</TabsContent>

			{customViews.map((v) => (
				<TabsContent key={v.id} value={v.id} className="mt-4">
					<CustomViewTabContent
						viewId={v.id}
						viewTitle={v.title}
						entityId={entityId}
						entityTitle={entity.title}
						entityForTodos={{
							id: entity.id,
							extractedFields: entity.extractedFields as string | null,
							timeline: entity.timeline ?? undefined,
						}}
						onDelete={() => deleteViewMutation.mutate({ viewId: v.id })}
						onEdit={() =>
							triggerAgentPrompt({
								text: `请修改事项「${entity.title}」(ID: ${entityId}) 的视图「${v.title}」(viewId: ${v.id})。先调用 get_view 看现有内容，再用 update_view 更新。`,
								entityId,
							})
						}
					/>
				</TabsContent>
			))}
		</Tabs>
	);
}

function CustomViewTabContent({
	viewId,
	viewTitle,
	entityId,
	entityTitle,
	entityForTodos,
	onDelete,
	onEdit,
}: {
	viewId: string;
	viewTitle: string;
	entityId: string;
	entityTitle: string;
	entityForTodos: { id: string; extractedFields: string | null; timeline?: typeof undefined | { id: string; type: string; metadata: string | null; createdAt: string | Date }[] };
	onDelete: () => void;
	onEdit: () => void;
}) {
	const { data: view, isLoading } = useQuery({
		...orpc.entityViews.get.queryOptions({ input: { viewId } }),
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-10">
				<Spinner className="size-5" />
			</div>
		);
	}
	if (!view) {
		return null;
	}

	const blocks = (view.spec as ViewSpec).blocks as ViewBlock[];

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-muted-foreground">{viewTitle}</h3>
				<div className="flex gap-1">
					<Button variant="ghost" size="sm" onClick={onEdit}>
						<SparklesIcon className="size-3.5 mr-1" />
						改视图
					</Button>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
								<Trash2Icon className="size-3.5 mr-1" />
								删除
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>删除视图「{viewTitle}」？</AlertDialogTitle>
								<AlertDialogDescription>
									仅删除视图本身，不影响事项内容、邮件、时间线。
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>取消</AlertDialogCancel>
								<AlertDialogAction onClick={onDelete}>删除</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>
			<ViewRenderer
				blocks={blocks}
				entityId={entityId}
				entityTitle={entityTitle}
				entity={entityForTodos}
			/>
		</div>
	);
}
