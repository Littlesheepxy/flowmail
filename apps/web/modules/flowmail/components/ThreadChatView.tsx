"use client";

import { Spinner, cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/components/tabs";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeftIcon,
	InboxIcon,
	MailIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	PaperclipIcon,
	FileIcon,
	FileTextIcon,
	ImageIcon,
	DownloadIcon,
	Reply as ReplyIcon,
	ReplyAllIcon,
	ForwardIcon,
	CheckIcon,
	XIcon,
	ListTodoIcon,
	AlertTriangleIcon,
	ActivityIcon,
	CheckCircle2Icon,
	CircleDotIcon,
	ZapIcon,
	PlayIcon,
	MoreHorizontalIcon,
	MergeIcon,
	SplitIcon,
	TagIcon,
	ScissorsIcon,
	SearchIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { EntityTimeline } from "./EntityTimeline";
import type { ReplyMode } from "./ReplyComposer";
import { ReplyComposer } from "./ReplyComposer";

import DOMPurify from "isomorphic-dompurify";

const Letter = dynamic(() => import("react-letter").then((m) => m.Letter), {
	ssr: false,
});

const TYPE_LABELS: Record<string, string> = {
	APPROVAL: "审批",
	REPORT: "汇报",
	ISSUE: "问题",
	FEEDBACK: "反馈",
};

const TYPE_COLORS: Record<string, string> = {
	APPROVAL: "#3b82f6",
	REPORT: "#10b981",
	ISSUE: "#ef4444",
	FEEDBACK: "#f59e0b",
};

interface AISuggestion {
	id?: string;
	intent: string;
	message: string;
	severity: "info" | "warning" | "critical";
	actions?: Array<{
		label: string;
		tool: string;
		params: Record<string, unknown>;
		confirmRequired: boolean;
	}>;
	status?: "pending" | "accepted" | "dismissed";
}

interface ThreadChatViewProps {
	entityId: string | null;
	onBack?: () => void;
}


export function ThreadChatView({ entityId, onBack }: ThreadChatViewProps) {
	const queryClient = useQueryClient();
	const { data: entity, isLoading } = useQuery({
		...orpc.flowEntities.get.queryOptions({
			input: { entityId: entityId ?? "" },
		}),
		enabled: !!entityId,
	});
	const [showComposer, setShowComposer] = useState(false);
	const [composerMode, setComposerMode] = useState<ReplyMode>("reply");

	const sendMutation = useMutation(
		orpc.emailConnections.sendEmail.mutationOptions(),
	);

	const handleSend = useCallback(
		async (data: { mode: ReplyMode; html: string; text: string }) => {
			if (!entity) {
				return;
			}
			const threads = entity.threads ?? [];
			const latestThread = threads[0];
			if (!latestThread) {
				return;
			}

			const connectionId = (latestThread as { connectionId?: string }).connectionId;
			if (!connectionId) {
				toast.error("找不到邮箱连接，无法发送");
				return;
			}

			const toRecipients = parseRecipients(latestThread.toRecipients);
			const ccRecipients = parseRecipients(latestThread.ccRecipients);
			const senderEmail = latestThread.sender ?? "";

			let to: string[];
			let cc: string[] | undefined;

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
			const rawSubject = latestThread.subject ?? "";
			const subject =
				rawSubject.startsWith("Re:") || rawSubject.startsWith("Fwd:")
					? rawSubject
					: `${subjectPrefix}${rawSubject}`;

			const messageId = (latestThread as { messageId?: string | null }).messageId;

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
				setShowComposer(false);

				await queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.queryOptions({
						input: { entityId: entityId ?? "" },
					}).queryKey,
				});
			} catch (err) {
				toast.error(
					`发送失败: ${err instanceof Error ? err.message : "未知错误"}`,
				);
			}
		},
		[entity, entityId, sendMutation, queryClient],
	);

	const openComposer = useCallback((mode: ReplyMode) => {
		setComposerMode(mode);
		setShowComposer(true);
	}, []);

	const [showMergeDialog, setShowMergeDialog] = useState(false);
	const [showReclassifyDialog, setShowReclassifyDialog] = useState(false);
	const [splitModeActive, setSplitModeActive] = useState(false);

	if (!entityId) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
				<InboxIcon className="size-12 mb-3 stroke-1" />
				<p className="text-sm font-medium">选择一封邮件查看详情</p>
				<p className="text-xs mt-1 text-muted-foreground/30">
					从左侧列表中选择一个条目
				</p>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<Spinner className="size-5 text-primary" />
			</div>
		);
	}

	if (!entity) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground">
				未找到该条目
			</div>
		);
	}

	const threads = entity.threads ?? [];
	const timeline = entity.timeline ?? [];
	const latestThread = threads[0];

	const classificationReasoning = (() => {
		const aiEvent = timeline.find(
			(e) => e.type === "ai_summary" && e.metadata,
		);
		if (!aiEvent?.metadata) {
			return null;
		}
		try {
			const meta =
				typeof aiEvent.metadata === "string"
					? JSON.parse(aiEvent.metadata)
					: aiEvent.metadata;
			return (meta.reasoning as string) ?? null;
		} catch {
			return null;
		}
	})();

	const categoryLabel =
		(entity as { category?: { name: string } }).category?.name ??
		TYPE_LABELS[entity.type] ??
		entity.type;
	const categoryColor =
		(entity as { category?: { color: string } }).category?.color ??
		TYPE_COLORS[entity.type] ??
		"#94a3b8";

	return (
		<div className="flex flex-col h-full">
			<div className="px-3 md:px-5 py-3 border-b shrink-0 flex items-start justify-between gap-2">
				{onBack && (
					<button
						type="button"
						className="shrink-0 mt-0.5 flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:bg-muted transition-colors md:hidden"
						onClick={onBack}
					>
						<ArrowLeftIcon className="size-4" />
					</button>
				)}
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 mb-0.5">
						<h2 className="text-sm md:text-base font-semibold truncate">{entity.title}</h2>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span
										className="inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium cursor-default border border-transparent hover:border-current/20 transition-colors"
										style={{
											backgroundColor: `${categoryColor}15`,
											color: categoryColor,
										}}
									>
										<span
											className="size-1.5 rounded-full"
											style={{ backgroundColor: categoryColor }}
										/>
										{categoryLabel}
									</span>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="max-w-[280px]">
									<p className="text-xs">
										{classificationReasoning
											? `AI 判断理由：${classificationReasoning}`
											: `AI 自动分类为「${categoryLabel}」`}
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
					{entity.aiSummary && (
						<p className="text-xs text-muted-foreground line-clamp-1">
							{entity.aiSummary}
						</p>
					)}
				</div>
				<EntityHeaderMenu
					canSplit={threads.length > 1}
					onMerge={() => setShowMergeDialog(true)}
					onSplit={() => setSplitModeActive(true)}
					onReclassify={() => setShowReclassifyDialog(true)}
				/>
			</div>

			<EntityActionBar entity={entity} />
			<EntityTagSection entityId={entity.id} tags={entity.tags ?? []} />

		<EntityTabs
			entity={entity}
			threads={threads}
			timeline={timeline}
			onReply={openComposer}
			splitModeExternal={splitModeActive}
			onSplitModeChange={setSplitModeActive}
		/>

		<MergeEntityDialog
			open={showMergeDialog}
			onOpenChange={setShowMergeDialog}
			sourceEntityId={entity.id}
			sourceTitle={entity.title}
			organizationId={entity.organizationId}
		/>

		<ReclassifyDialog
			open={showReclassifyDialog}
			onOpenChange={setShowReclassifyDialog}
			entityId={entity.id}
			currentType={entity.type}
		/>

		{/* Reply Composer */}
		{showComposer && latestThread && (
			<ReplyComposer
				senderName={latestThread.senderName ?? undefined}
				senderEmail={latestThread.sender ?? ""}
				subject={latestThread.subject ?? ""}
				toRecipients={parseRecipients(latestThread.toRecipients)}
				ccRecipients={parseRecipients(latestThread.ccRecipients)}
				defaultMode={composerMode}
				onSend={handleSend}
				onClose={() => setShowComposer(false)}
				isSending={sendMutation.isPending}
			/>
		)}

		{/* Bottom action buttons */}
		{!showComposer && threads.length > 0 && (
			<div className="border-t px-3 md:px-5 py-3 shrink-0 flex items-center gap-2">
				<Button
					variant="secondary"
					className="gap-2"
					onClick={() => openComposer("reply")}
				>
					<ReplyIcon className="size-4" />
					回复
				</Button>
				<Button
					variant="secondary"
					className="gap-2"
					onClick={() => openComposer("forward")}
				>
					<ForwardIcon className="size-4" />
					转发
				</Button>
			</div>
		)}
		</div>
	);
}

// ─── Types ───

interface AttachmentItem {
	id: string;
	filename: string;
	mimeType?: string | null;
	size?: number | null;
	externalId: string;
	contentId?: string | null;
	storageKey?: string | null;
}

interface ThreadItem {
	id: string;
	subject: string | null;
	sender: string | null;
	senderName?: string | null;
	toRecipients?: string | null;
	ccRecipients?: string | null;
	snippet: string | null;
	bodyHtml?: string | null;
	bodyText?: string | null;
	attachments?: AttachmentItem[];
	receivedAt: string | Date;
}

interface EmailRecipient {
	name?: string;
	address: string;
}

// ─── Email List ───

function EmailListView({
	threads,
	onReply,
	splitMode,
	selectedThreadIds,
	onToggleThread,
}: {
	threads: ThreadItem[];
	onReply?: (mode: ReplyMode) => void;
	splitMode?: boolean;
	selectedThreadIds?: Set<string>;
	onToggleThread?: (id: string) => void;
}) {
	const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
		if (threads.length > 0) {
			return new Set([threads[0].id]);
		}
		return new Set();
	});

	if (threads.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
				<MailIcon className="size-10 mb-3 stroke-1" />
				<p className="text-sm font-medium">暂无关联邮件</p>
				<p className="text-xs mt-1 text-muted-foreground/30">
					邮件处理后会自动关联到此条目
				</p>
			</div>
		);
	}

	function toggleExpand(id: string) {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	const participants = [...new Set(threads.map((t) => t.senderName || t.sender || "").filter(Boolean))];
	const oldest = threads.length > 0 ? threads[threads.length - 1] : null;

	return (
		<div>
			{threads.length > 1 && (
				<div className="flex items-center gap-2 px-5 py-2 text-[11px] text-muted-foreground border-b bg-muted/20">
					<MailIcon className="size-3" />
					<span>共 {threads.length} 封邮件</span>
					<span className="text-muted-foreground/40">·</span>
					<span>{participants.length} 位参与者</span>
					{oldest && (
						<>
							<span className="text-muted-foreground/40">·</span>
							<span>最早 {formatDate(oldest.receivedAt)}</span>
						</>
					)}
				</div>
			)}
			<div className="px-3">
				{threads.map((thread, idx) => {
					const isExpanded = expandedIds.has(thread.id);
					const isLast = idx === threads.length - 1;
					const isSelected = selectedThreadIds?.has(thread.id) ?? false;
					return (
						<div key={thread.id} className="flex items-start">
							{splitMode && (
								<button
									type="button"
									className={cn(
										"mt-5 ml-1 shrink-0 size-4 rounded border-2 transition-colors flex items-center justify-center",
										isSelected
											? "bg-primary border-primary text-primary-foreground"
											: "border-muted-foreground/30 hover:border-primary/50",
									)}
									onClick={() => onToggleThread?.(thread.id)}
								>
									{isSelected && <CheckIcon className="size-2.5" />}
								</button>
							)}
							<div className="flex-1 min-w-0">
								<EmailMessage
									thread={thread}
									isExpanded={isExpanded}
									onToggle={() => toggleExpand(thread.id)}
									onReply={onReply}
									showConnector={threads.length > 1 && !isLast}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// ─── Single Email Message ───

function EmailMessage({
	thread,
	isExpanded,
	onToggle,
	onReply,
	showConnector = false,
}: {
	thread: ThreadItem;
	isExpanded: boolean;
	onToggle: () => void;
	onReply?: (mode: ReplyMode) => void;
	showConnector?: boolean;
}) {
	const displayName = thread.senderName || thread.sender || "Unknown";
	const emailAddress = thread.sender || "";
	const initial = displayName.charAt(0).toUpperCase();
	const attachments = thread.attachments ?? [];
	const hasAttachments = attachments.length > 0;

	const toRecipients = useMemo(() => parseRecipients(thread.toRecipients), [thread.toRecipients]);
	const ccRecipients = useMemo(() => parseRecipients(thread.ccRecipients), [thread.ccRecipients]);

	return (
		<div className={cn("transition-colors", isExpanded ? "bg-background" : "hover:bg-muted/30")}>
			{/* biome-ignore lint/a11y/useSemanticElements: cannot use <button> here because it would nest inside other buttons */}
			<div
				role="button"
				tabIndex={0}
				aria-expanded={isExpanded}
				onClick={onToggle}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") { onToggle(); }
				}}
				className="w-full text-left px-2 py-3.5 flex items-start gap-0 cursor-pointer"
			>
				<div className="flex flex-col items-center shrink-0 w-12">
					<div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
						{initial}
					</div>
					{showConnector && (
						<div className="w-0.5 flex-1 min-h-[12px] mt-1 rounded-full bg-border" />
					)}
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="text-sm font-semibold truncate">
							{displayName}
						</span>
						{displayName !== emailAddress && emailAddress && (
							<span className="text-xs text-muted-foreground truncate hidden sm:inline">
								&lt;{emailAddress}&gt;
							</span>
						)}
						{hasAttachments && !isExpanded && (
							<PaperclipIcon className="size-3.5 text-muted-foreground shrink-0" />
						)}
						<span className="text-[11px] text-muted-foreground shrink-0 ml-auto">
							{formatDate(thread.receivedAt)}
						</span>
						{isExpanded ? (
							<ChevronUpIcon className="size-3.5 text-muted-foreground shrink-0" />
						) : (
							<ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0" />
						)}
					</div>

					{!isExpanded && (
						<>
							{thread.subject && (
								<p className="text-sm text-muted-foreground truncate mt-0.5">
									{thread.subject}
								</p>
							)}
							{thread.snippet && (
								<p className="text-xs text-muted-foreground/60 truncate mt-0.5">
									{thread.snippet}
								</p>
							)}
						</>
					)}

				{isExpanded && toRecipients.length > 0 && (
					<RecipientLine to={toRecipients} cc={ccRecipients} />
				)}

				{isExpanded && (
					<div className="flex items-center gap-1 mt-2 -ml-1">
						<TooltipProvider delayDuration={300}>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="secondary" size="sm" className="h-7 px-2.5 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); onReply?.("reply"); }}>
										<ReplyIcon className="size-3.5" />
										回复
									</Button>
								</TooltipTrigger>
								<TooltipContent>回复</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="secondary" size="sm" className="h-7 px-2.5 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); onReply?.("replyAll"); }}>
										<ReplyAllIcon className="size-3.5" />
										全部回复
									</Button>
								</TooltipTrigger>
								<TooltipContent>全部回复</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="secondary" size="sm" className="h-7 px-2.5 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); onReply?.("forward"); }}>
										<ForwardIcon className="size-3.5" />
										转发
									</Button>
								</TooltipTrigger>
								<TooltipContent>转发</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
				)}
			</div>
		</div>

		{/* Expanded Content */}
			{isExpanded && (
				<div className="px-3 md:px-5 pb-5">
					{/* Email Body */}
					<div className="md:max-w-[680px] md:mx-auto">
						<EmailBody thread={thread} />

						{/* Attachments */}
						{hasAttachments && (
							<AttachmentBar attachments={attachments} />
						)}
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Recipient Line ───

function RecipientLine({ to, cc }: { to: EmailRecipient[]; cc: EmailRecipient[] }) {
	const [expanded, setExpanded] = useState(false);
	const totalCount = to.length + cc.length;

	if (totalCount === 0) {
		return null;
	}

	const firstTo = to[0];
	const remaining = totalCount - 1;

	return (
		<div className="text-xs text-muted-foreground mt-0.5">
			<span>发送给 </span>
			<span className="text-foreground/70">{firstTo?.name || firstTo?.address}</span>
			{remaining > 0 && !expanded && (
				<button
					type="button"
					onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
					className="ml-1 text-primary hover:underline"
				>
					+{remaining} 人
				</button>
			)}
			{expanded && (
				<span>
					{to.slice(1).map((r) => (
						<span key={r.address}>
							, <span className="text-foreground/70">{r.name || r.address}</span>
						</span>
					))}
					{cc.length > 0 && (
						<span className="ml-1">
							| 抄送: {cc.map((r) => r.name || r.address).join(", ")}
						</span>
					)}
				</span>
			)}
		</div>
	);
}

// ─── Email Body ───

function EmailBody({ thread }: { thread: ThreadItem }) {
	const [showQuoted, setShowQuoted] = useState(false);

	if (thread.bodyHtml) {
		const sanitizedHtml = DOMPurify.sanitize(thread.bodyHtml);
		return (
			<div className="email-body-wrapper">
				<div className={cn("email-body", !showQuoted && "hide-quoted")}>
					<Letter html={sanitizedHtml} />
				</div>
				{sanitizedHtml.includes("blockquote") && !showQuoted && (
					<button
						type="button"
						onClick={() => setShowQuoted(true)}
						className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						··· 显示引用内容
					</button>
				)}
			</div>
		);
	}

	if (thread.bodyText) {
		return (
			<pre className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">
				{thread.bodyText}
			</pre>
		);
	}

	if (thread.snippet) {
		return (
			<p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
				{thread.snippet}
			</p>
		);
	}

	return (
		<p className="text-sm text-muted-foreground italic">(无预览内容)</p>
	);
}

// ─── Attachment Bar ───

function AttachmentBar({ attachments }: { attachments: AttachmentItem[] }) {
	const [expanded, setExpanded] = useState(false);
	const visible = expanded ? attachments : attachments.slice(0, 3);

	return (
		<div className="mt-4 pt-3 border-t">
			<div className="flex items-center gap-2 mb-2">
				<PaperclipIcon className="size-3.5 text-muted-foreground" />
				<span className="text-xs font-medium text-muted-foreground">
					{attachments.length} 个附件
				</span>
			</div>
			<div className="flex flex-wrap gap-2">
				{visible.map((att) => (
					<AttachmentChip key={att.id} attachment={att} />
				))}
			</div>
			{attachments.length > 3 && !expanded && (
				<button
					type="button"
					onClick={() => setExpanded(true)}
					className="mt-2 text-xs text-primary hover:underline"
				>
					显示全部 {attachments.length} 个附件
				</button>
			)}
		</div>
	);
}

function AttachmentChip({ attachment }: { attachment: AttachmentItem }) {
	const Icon = getFileIcon(attachment.mimeType);
	const sizeStr = attachment.size ? formatFileSize(attachment.size) : "";
	const [downloading, setDownloading] = useState(false);

	const hasStorage = !!attachment.storageKey;

	async function handleDownload() {
		if (!hasStorage) { return; }
		setDownloading(true);
		try {
			const res = await fetch("/api/rpc/flowEntities/getAttachmentUrl", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ attachmentId: attachment.id }),
			});
			if (res.ok) {
				const data = (await res.json()) as { json?: { url?: string } };
				const url = data?.json?.url;
				if (url) {
					const a = document.createElement("a");
					a.href = url;
					a.download = attachment.filename;
					a.target = "_blank";
					a.rel = "noopener noreferrer";
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
				}
			}
		} finally {
			setDownloading(false);
		}
	}

	return (
		<div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors group max-w-[240px]">
			<Icon className="size-4 text-muted-foreground shrink-0" />
			<div className="flex-1 min-w-0">
				<p className="text-xs font-medium truncate">{attachment.filename}</p>
				{sizeStr && (
					<p className="text-[10px] text-muted-foreground">{sizeStr}</p>
				)}
				{!hasStorage && (
					<p className="text-[10px] text-amber-500">暂不可下载</p>
				)}
			</div>
			{hasStorage && (
				<button
					type="button"
					onClick={handleDownload}
					disabled={downloading}
					className="size-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-background transition-all disabled:opacity-50"
					title="下载"
				>
					{downloading ? (
						<Spinner className="size-3.5" />
					) : (
						<DownloadIcon className="size-3.5 text-muted-foreground" />
					)}
				</button>
			)}
		</div>
	);
}


// ─── Utilities ───

function formatDate(date: string | Date): string {
	const d = new Date(date);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) {
		return "刚刚";
	}
	if (diffMins < 60) {
		return `${diffMins} 分钟前`;
	}
	if (diffHours < 24) {
		return `${diffHours} 小时前`;
	}
	if (diffDays < 7) {
		return `${diffDays} 天前`;
	}

	const isSameYear = d.getFullYear() === now.getFullYear();
	if (isSameYear) {
		return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
	return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function pad(n: number): string {
	return n.toString().padStart(2, "0");
}

function parseRecipients(raw?: string | null): EmailRecipient[] {
	if (!raw) {
		return [];
	}
	try {
		return JSON.parse(raw) as EmailRecipient[];
	} catch {
		return [];
	}
}

function getFileIcon(mimeType?: string | null) {
	if (!mimeType) {
		return FileIcon;
	}
	if (mimeType.startsWith("image/")) {
		return ImageIcon;
	}
	if (mimeType === "application/pdf" || mimeType.includes("text")) {
		return FileTextIcon;
	}
	return FileIcon;
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Entity Tabs (邮件 / 动态 / 待办) ───

function EntityTabs({
	entity,
	threads,
	timeline,
	onReply,
	splitModeExternal,
	onSplitModeChange,
}: {
	entity: {
		id: string;
		title: string;
		type: string;
		status: string;
		extractedFields?: unknown;
	};
	threads: ThreadItem[];
	timeline: Array<{
		id: string;
		type: string;
		content: string;
		metadata?: string | null;
		createdAt: string | Date;
		actor?: { id: string; name: string | null; image: string | null } | null;
	}>;
	onReply: (mode: ReplyMode) => void;
	splitModeExternal?: boolean;
	onSplitModeChange?: (v: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const splitMode = splitModeExternal ?? false;
	const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());

	const splitMutation = useMutation(
		orpc.flowEntities.split.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.get.key({ input: { entityId: entity.id } }) });
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.list.key() });
				toast.success("已拆分为新事项");
				onSplitModeChange?.(false);
				setSelectedThreadIds(new Set());
			},
		}),
	);

	function toggleThread(id: string) {
		setSelectedThreadIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	const fields = parseFields(entity.extractedFields);
	const nextActions = (fields.nextActions ?? []) as string[];
	const blockers = (fields.blockers ?? []) as string[];
	const inProgressItems = (fields.inProgressItems ?? []) as string[];
	const completedItems = (fields.completedItems ?? []) as string[];

	const latestSuggestions = useMemo(() => {
		const aiEvents = [...timeline]
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.filter((e) => e.type === "ai_summary");
		if (aiEvents.length === 0) {
			return [];
		}
		const meta = parseFields(aiEvents[0].metadata);
		return (meta.suggestions ?? []) as AISuggestion[];
	}, [timeline]);

	const pendingSuggestions = latestSuggestions.filter((s) => s.status === "pending" || !s.status);
	const todoCount = nextActions.length + blockers.length + inProgressItems.length + pendingSuggestions.length;
	const hasTodos = todoCount > 0 || completedItems.length > 0;

	return (
		<Tabs defaultValue="emails" className="flex flex-col flex-1 min-h-0">
			<div className="px-3 md:px-5 shrink-0">
				<TabsList className="w-full justify-start gap-0 border-b-0 bg-transparent">
					<TabsTrigger value="emails" className="gap-1.5 text-xs">
						<MailIcon className="size-3.5" />
						邮件
						{threads.length > 0 && (
							<span className="ml-0.5 text-[10px] text-muted-foreground">
								{threads.length}
							</span>
						)}
					</TabsTrigger>
					<TabsTrigger value="activity" className="gap-1.5 text-xs">
						<ActivityIcon className="size-3.5" />
						动态
						{timeline.length > 0 && (
							<span className="ml-0.5 text-[10px] text-muted-foreground">
								{timeline.length}
							</span>
						)}
					</TabsTrigger>
					{hasTodos && (
						<TabsTrigger value="todos" data-tab-trigger="todos" className="gap-1.5 text-xs">
							<ListTodoIcon className="size-3.5" />
							待办
							{todoCount > 0 && (
								<span className="ml-0.5 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
									{todoCount}
								</span>
							)}
						</TabsTrigger>
					)}
				</TabsList>
			</div>

			<TabsContent value="emails" className="flex-1 overflow-y-auto mt-0 min-h-0">
				{splitMode && (
					<div className="flex items-center gap-2 px-5 py-2 border-b bg-amber-50/50 dark:bg-amber-950/20">
						<ScissorsIcon className="size-3.5 text-amber-600 dark:text-amber-400" />
						<span className="flex-1 text-xs text-amber-700 dark:text-amber-300">选择要拆分的邮件</span>
						<Button
							size="sm"
							className="h-6 px-2 text-[11px]"
							disabled={selectedThreadIds.size === 0 || selectedThreadIds.size === threads.length || splitMutation.isPending}
							onClick={() => splitMutation.mutate({ entityId: entity.id, threadIds: [...selectedThreadIds] })}
						>
							{splitMutation.isPending ? <Spinner className="size-3" /> : <SplitIcon className="size-3 mr-1" />}
							拆分 ({selectedThreadIds.size})
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-6 px-2 text-[11px]"
							onClick={() => { onSplitModeChange?.(false); setSelectedThreadIds(new Set()); }}
						>
							取消
						</Button>
					</div>
				)}
				<EmailListView
					threads={threads}
					onReply={onReply}
					splitMode={splitMode}
					selectedThreadIds={selectedThreadIds}
					onToggleThread={toggleThread}
				/>
			</TabsContent>

			<TabsContent value="activity" className="flex-1 overflow-y-auto mt-0 min-h-0 px-3 md:px-5 py-4">
				<EntityTimeline
					entityId={entity.id}
					entityTitle={entity.title}
					events={timeline.map((e) => ({
						...e,
						createdAt: typeof e.createdAt === "string" ? e.createdAt : e.createdAt.toString(),
						actor: e.actor
							? { id: e.actor.id, name: e.actor.name ?? "", image: e.actor.image }
							: null,
					}))}
					entityType={entity.type}
					status={entity.status}
					extractedFields={entity.extractedFields as string | null}
				/>
			</TabsContent>

			{hasTodos && (
				<TabsContent value="todos" className="flex-1 overflow-y-auto mt-0 min-h-0 px-3 md:px-5 py-4">
					<TodoPanel
						entityId={entity.id}
						nextActions={nextActions}
						blockers={blockers}
						inProgressItems={inProgressItems}
						completedItems={completedItems}
						suggestions={pendingSuggestions}
					/>
				</TabsContent>
			)}
		</Tabs>
	);
}

// ─── Todo Panel ───

function TodoPanel({
	entityId,
	nextActions,
	blockers,
	inProgressItems,
	completedItems,
	suggestions,
}: {
	entityId: string;
	nextActions: string[];
	blockers: string[];
	inProgressItems: string[];
	completedItems: string[];
	suggestions: AISuggestion[];
}) {
	const hasActive = blockers.length > 0 || inProgressItems.length > 0 || nextActions.length > 0;

	return (
		<div className="space-y-5">
			{suggestions.length > 0 && (
				<div>
					<div className="flex items-center gap-1.5 mb-2">
						<ZapIcon className="size-3.5 text-violet-500" />
						<span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">
							AI 建议
						</span>
						<span className="text-[10px] text-violet-500/60">{suggestions.length}</span>
					</div>
					<div className="space-y-2">
						{suggestions.map((sug, idx) => (
							<SuggestionCard key={sug.id ?? idx} suggestion={sug} entityId={entityId} />
						))}
					</div>
				</div>
			)}

			{blockers.length > 0 && (
				<div>
					<div className="flex items-center gap-1.5 mb-2">
						<AlertTriangleIcon className="size-3.5 text-red-500" />
						<span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
							阻塞项
						</span>
						<span className="text-[10px] text-red-500/60">{blockers.length}</span>
					</div>
					<div className="space-y-1.5">
						{blockers.map((b) => (
							<div
								key={b}
								className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 dark:border-red-900 dark:bg-red-950/20"
							>
								<AlertTriangleIcon className="size-3.5 mt-0.5 shrink-0 text-red-500" />
								<span className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{b}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{inProgressItems.length > 0 && (
				<div>
					<div className="flex items-center gap-1.5 mb-2">
						<CircleDotIcon className="size-3.5 text-blue-500" />
						<span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
							进行中
						</span>
						<span className="text-[10px] text-blue-500/60">{inProgressItems.length}</span>
					</div>
					<div className="space-y-1.5">
						{inProgressItems.map((item) => (
							<div
								key={item}
								className="flex items-start gap-2.5 rounded-lg border px-3 py-2 bg-blue-50/30 border-blue-200/50 dark:bg-blue-950/10 dark:border-blue-900/50"
							>
								<CircleDotIcon className="size-3.5 mt-0.5 shrink-0 text-blue-500" />
								<span className="text-xs text-foreground/80 leading-relaxed">{item}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{nextActions.length > 0 && (
				<div>
					<div className="flex items-center gap-1.5 mb-2">
						<ListTodoIcon className="size-3.5 text-amber-500" />
						<span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
							下一步
						</span>
						<span className="text-[10px] text-amber-500/60">{nextActions.length}</span>
					</div>
					<div className="space-y-1.5">
						{nextActions.map((a) => (
							<div
								key={a}
								className="flex items-start gap-2.5 rounded-lg border px-3 py-2"
							>
								<div className="size-3.5 mt-0.5 shrink-0 rounded border-2 border-muted-foreground/30" />
								<span className="text-xs text-foreground/80 leading-relaxed">{a}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{completedItems.length > 0 && (
				<div>
					<div className="flex items-center gap-1.5 mb-2">
						<CheckCircle2Icon className="size-3.5 text-emerald-500" />
						<span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
							已完成
						</span>
						<span className="text-[10px] text-emerald-500/60">{completedItems.length}</span>
					</div>
					<div className="space-y-1.5">
						{completedItems.map((item) => (
							<div
								key={item}
								className="flex items-start gap-2.5 rounded-lg border px-3 py-2 bg-muted/20"
							>
								<CheckCircle2Icon className="size-3.5 mt-0.5 shrink-0 text-emerald-500" />
								<span className="text-xs text-muted-foreground line-through leading-relaxed">{item}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{!hasActive && completedItems.length > 0 && suggestions.length === 0 && (
				<div className="flex items-center gap-2 rounded-lg bg-emerald-50/50 border border-emerald-200/50 px-3 py-2 dark:bg-emerald-950/20 dark:border-emerald-900/50">
					<CheckCircle2Icon className="size-4 text-emerald-500" />
					<span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">所有事项已完成</span>
				</div>
			)}
		</div>
	);
}

// ─── Suggestion Card with Action Buttons ───

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
	critical: {
		bg: "bg-red-50/50 dark:bg-red-950/20",
		border: "border-red-200 dark:border-red-900",
		icon: "text-red-500",
	},
	warning: {
		bg: "bg-amber-50/50 dark:bg-amber-950/20",
		border: "border-amber-200 dark:border-amber-900",
		icon: "text-amber-500",
	},
	info: {
		bg: "bg-violet-50/50 dark:bg-violet-950/20",
		border: "border-violet-200 dark:border-violet-900",
		icon: "text-violet-500",
	},
};

const TOOL_LABELS: Record<string, string> = {
	approve_entity: "批准",
	reject_entity: "拒绝",
	update_entity_status: "更新状态",
	add_timeline_event: "添加记录",
	send_email: "发送邮件",
	create_ticket: "创建工单",
};

function SuggestionCard({ suggestion, entityId }: { suggestion: AISuggestion; entityId: string }) {
	const queryClient = useQueryClient();
	const style = SEVERITY_STYLES[suggestion.severity] ?? SEVERITY_STYLES.info;

	const approveMutation = useMutation(
		orpc.approvals.approve.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.key({ input: { entityId } }),
				});
				toast.success("已批准");
			},
		}),
	);

	const rejectMutation = useMutation(
		orpc.approvals.reject.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.key({ input: { entityId } }),
				});
				toast.success("已拒绝");
			},
		}),
	);

	function handleAction(action: { tool: string; params: Record<string, unknown>; label: string }) {
		switch (action.tool) {
			case "approve_entity":
				approveMutation.mutate({ entityId });
				break;
			case "reject_entity":
				rejectMutation.mutate({ entityId, reason: String(action.params.reason ?? "Rejected") });
				break;
			default:
				toast.info(`${action.label}：功能开发中`);
		}
	}

	const actionPending = approveMutation.isPending || rejectMutation.isPending;

	return (
		<div className={cn("rounded-lg border px-3 py-2.5 space-y-2", style.bg, style.border)}>
			<div className="flex items-start gap-2">
				<ZapIcon className={cn("size-3.5 mt-0.5 shrink-0", style.icon)} />
				<div className="min-w-0 flex-1">
					<div className="text-[11px] font-medium text-muted-foreground mb-0.5">{suggestion.intent}</div>
					<div className="text-xs text-foreground/80 leading-relaxed">{suggestion.message}</div>
				</div>
			</div>

			{suggestion.actions && suggestion.actions.length > 0 && (
				<div className="flex items-center gap-1.5 pl-5">
					{suggestion.actions.map((action) => (
						<Button
							key={action.tool}
							size="sm"
							variant={action.tool === "reject_entity" ? "destructive" : "primary"}
							className="h-6 px-2.5 text-[11px] gap-1"
							disabled={actionPending}
							onClick={() => handleAction({ ...action, label: TOOL_LABELS[action.tool] ?? action.label })}
						>
							<PlayIcon className="size-2.5" />
							{TOOL_LABELS[action.tool] ?? action.label}
						</Button>
					))}
				</div>
			)}
		</div>
	);
}

// ─── Entity Tag Section ───

function EntityTagSection({
	entityId,
	tags,
}: {
	entityId: string;
	tags: Array<{ tag: { id: string; name: string; color: string; source: string } }>;
}) {
	const [showInput, setShowInput] = useState(false);
	const [newTag, setNewTag] = useState("");
	const queryClient = useQueryClient();

	const addMutation = useMutation(
		orpc.tags.addToEntity.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.get.key({ input: { entityId } }) });
				setNewTag("");
				setShowInput(false);
			},
		}),
	);

	const removeMutation = useMutation(
		orpc.tags.removeFromEntity.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.get.key({ input: { entityId } }) });
			},
		}),
	);

	function handleAddTag() {
		const name = newTag.trim();
		if (!name) {
			return;
		}
		addMutation.mutate({ entityId, tagName: name });
	}

	if (tags.length === 0 && !showInput) {
		return (
			<div className="px-5 py-1.5 border-b">
				<button
					type="button"
					className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
					onClick={() => setShowInput(true)}
				>
					<TagIcon className="size-3" />
					添加标签
				</button>
			</div>
		);
	}

	return (
		<div className="px-5 py-1.5 border-b flex items-center gap-1.5 flex-wrap">
			{tags.map((et) => (
				<span
					key={et.tag.id}
					className="group inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
					style={{
						backgroundColor: `${et.tag.color}15`,
						color: et.tag.color,
					}}
				>
					{et.tag.name}
					<button
						type="button"
						className="opacity-0 group-hover:opacity-100 transition-opacity -mr-0.5"
						onClick={() => removeMutation.mutate({ entityId, tagId: et.tag.id })}
					>
						<XIcon className="size-2.5" />
					</button>
				</span>
			))}
			{showInput ? (
				<form
					className="inline-flex items-center"
					onSubmit={(e) => { e.preventDefault(); handleAddTag(); }}
				>
					<input
						className="h-5 w-20 rounded border bg-transparent px-1.5 text-[11px] outline-none focus:ring-1 focus:ring-primary/30"
						placeholder="标签名"
						value={newTag}
						onChange={(e) => setNewTag(e.target.value)}
						onBlur={() => { if (!newTag.trim()) { setShowInput(false); } }}
						ref={(el) => el?.focus()}
					/>
				</form>
			) : (
				<button
					type="button"
					className="inline-flex items-center justify-center size-5 rounded-full border border-dashed border-muted-foreground/20 text-muted-foreground/40 hover:border-primary/40 hover:text-primary/60 transition-colors"
					onClick={() => setShowInput(true)}
				>
					<span className="text-xs leading-none">+</span>
				</button>
			)}
		</div>
	);
}

// ─── Entity Header Menu ───

function EntityHeaderMenu({
	canSplit,
	onMerge,
	onSplit,
	onReclassify,
}: {
	canSplit: boolean;
	onMerge: () => void;
	onSplit: () => void;
	onReclassify: () => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
					<MoreHorizontalIcon className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuItem onClick={onMerge}>
					<MergeIcon className="size-3.5 mr-2" />
					合并到其他事项
				</DropdownMenuItem>
				{canSplit && (
					<DropdownMenuItem onClick={onSplit}>
						<ScissorsIcon className="size-3.5 mr-2" />
						拆分邮件
					</DropdownMenuItem>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={onReclassify}>
					<TagIcon className="size-3.5 mr-2" />
					重新分类
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ─── Merge Entity Dialog ───

function MergeEntityDialog({
	open,
	onOpenChange,
	sourceEntityId,
	sourceTitle,
	organizationId,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	sourceEntityId: string;
	sourceTitle: string;
	organizationId: string;
}) {
	const [search, setSearch] = useState("");
	const queryClient = useQueryClient();

	const { data: entities } = useQuery(
		orpc.flowEntities.list.queryOptions({
			input: { organizationId, limit: 50 },
		}),
	);

	const candidates = useMemo(() => {
		const all = (entities?.entities ?? []).filter(
			(e: { id: string }) => e.id !== sourceEntityId,
		);
		if (!search.trim()) {
			return all.slice(0, 10);
		}
		const q = search.toLowerCase();
		return all
			.filter((e: { title: string }) => e.title.toLowerCase().includes(q))
			.slice(0, 10);
	}, [entities, sourceEntityId, search]);

	const mergeMutation = useMutation(
		orpc.flowEntities.merge.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.list.key() });
				toast.success("合并成功");
				onOpenChange(false);
			},
		}),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-sm">合并到其他事项</DialogTitle>
				</DialogHeader>
				<p className="text-xs text-muted-foreground mb-3">
					将「{sourceTitle}」的所有邮件和动态合并到目标事项中，合并后原事项将被删除。
				</p>
				<div className="relative mb-3">
					<SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
					<Input
						placeholder="搜索目标事项..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-8 h-8 text-xs"
					/>
				</div>
				<div className="max-h-60 overflow-y-auto space-y-1">
					{candidates.map((e: { id: string; title: string; type: string; status: string; updatedAt: string | Date }) => (
						<button
							key={e.id}
							type="button"
							className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
							disabled={mergeMutation.isPending}
							onClick={() => mergeMutation.mutate({ targetEntityId: e.id, sourceEntityId })}
						>
							<div className="text-xs font-medium truncate">{e.title}</div>
							<div className="text-[10px] text-muted-foreground mt-0.5">
								{e.type} · {e.status} · {new Date(e.updatedAt).toLocaleDateString()}
							</div>
						</button>
					))}
					{candidates.length === 0 && (
						<p className="text-xs text-muted-foreground text-center py-4">没有找到可合并的事项</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ─── Reclassify Dialog ───

const ENTITY_TYPES = [
	{ value: "APPROVAL", label: "审批", desc: "请审批、签字确认", color: "bg-blue-500", hex: "#3b82f6" },
	{ value: "REPORT", label: "汇报", desc: "周报、进展更新", color: "bg-emerald-500", hex: "#10b981" },
	{ value: "ISSUE", label: "问题", desc: "工单、Bug、投诉", color: "bg-red-500", hex: "#ef4444" },
	{ value: "FEEDBACK", label: "反馈", desc: "建议、评审意见", color: "bg-amber-500", hex: "#f59e0b" },
] as const;

function ReclassifyDialog({
	open,
	onOpenChange,
	entityId,
	currentType,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	entityId: string;
	currentType: string;
}) {
	const queryClient = useQueryClient();

	const reclassifyMutation = useMutation(
		orpc.flowEntities.reclassify.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.get.key({ input: { entityId } }) });
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.list.key() });
				toast.success("分类已更新");
				onOpenChange(false);
			},
		}),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="text-sm">修改分类</DialogTitle>
					<DialogDescription className="text-xs">
						AI 已自动分类，如果不准确可以手动调整
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-1.5 mt-1">
					{ENTITY_TYPES.map((t) => (
						<button
							key={t.value}
							type="button"
							className={cn(
								"flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
								currentType === t.value
									? "border-primary bg-primary/5"
									: "hover:bg-muted/50",
							)}
							disabled={reclassifyMutation.isPending || currentType === t.value}
							onClick={() => reclassifyMutation.mutate({ entityId, type: t.value as "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK" })}
						>
							<div
								className="size-3 rounded-full shrink-0"
								style={{ backgroundColor: t.hex }}
							/>
							<div className="min-w-0 flex-1">
								<span className="text-xs font-medium text-foreground">{t.label}</span>
								<p className="text-[10px] text-muted-foreground">{t.desc}</p>
							</div>
							{currentType === t.value && (
								<CheckIcon className="size-3.5 shrink-0 text-primary" />
							)}
						</button>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ─── Entity Action Bar ───

function parseFields(raw: unknown): Record<string, unknown> {
	if (!raw) {
		return {};
	}
	if (typeof raw === "string") {
		try {
			return JSON.parse(raw);
		} catch {
			return {};
		}
	}
	return raw as Record<string, unknown>;
}

function EntityActionBar({
	entity,
}: {
	entity: {
		id: string;
		type: string;
		status: string;
		extractedFields?: unknown;
		aiSummary?: string | null;
	};
}) {
	const queryClient = useQueryClient();

	const approveMutation = useMutation(
		orpc.approvals.approve.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.key({
						input: { entityId: entity.id },
					}),
				});
				toast.success("已批准");
			},
		}),
	);

	const rejectMutation = useMutation(
		orpc.approvals.reject.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.key({
						input: { entityId: entity.id },
					}),
				});
				toast.success("已拒绝");
			},
		}),
	);

	const fields = parseFields(entity.extractedFields);
	const isApproval = entity.type === "APPROVAL";
	const isPending = entity.status === "pending";
	const actionPending =
		approveMutation.isPending || rejectMutation.isPending;

	const nextActions = (fields.nextActions ?? []) as string[];
	const blockers = (fields.blockers ?? []) as string[];
	const hasActions = nextActions.length > 0 || blockers.length > 0;

	const keyFields: Array<{ label: string; value: string }> = [];
	if (fields.applicant) {
		keyFields.push({ label: "申请人", value: String(fields.applicant) });
	}
	if (fields.department) {
		keyFields.push({ label: "部门", value: String(fields.department) });
	}
	if (fields.amount) {
		keyFields.push({ label: "金额", value: String(fields.amount) });
	}
	if (fields.deadline) {
		keyFields.push({ label: "截止", value: String(fields.deadline) });
	}
	if (fields.reporter) {
		keyFields.push({ label: "汇报人", value: String(fields.reporter) });
	}
	if (fields.progress) {
		keyFields.push({ label: "进度", value: String(fields.progress) });
	}
	if (fields.priority) {
		keyFields.push({ label: "优先级", value: String(fields.priority) });
	}

	const showBar =
		(isApproval && isPending) || keyFields.length > 0 || hasActions;

	if (!showBar) {
		return null;
	}

	return (
		<div className="shrink-0 border-b bg-muted/20 px-3 md:px-5 py-3 space-y-2.5">
			{keyFields.length > 0 && (
				<div className="flex flex-wrap gap-x-4 gap-y-1">
					{keyFields.map((f) => (
						<div key={f.label} className="flex items-center gap-1.5 text-xs">
							<span className="text-muted-foreground">{f.label}</span>
							<span className="font-medium">{f.value}</span>
						</div>
					))}
				</div>
			)}

			{isApproval && isPending && (
				<div className="flex items-center gap-2">
					<Button
						size="sm"
						className="h-8 gap-1.5"
						disabled={actionPending}
						onClick={() =>
							approveMutation.mutate({ entityId: entity.id })
						}
					>
						<CheckIcon className="size-3.5" />
						批准
					</Button>
					<Button
						size="sm"
						variant="destructive"
						className="h-8 gap-1.5"
						disabled={actionPending}
						onClick={() =>
							rejectMutation.mutate({
								entityId: entity.id,
								reason: "Rejected",
							})
						}
					>
						<XIcon className="size-3.5" />
						拒绝
					</Button>
				</div>
			)}

			{blockers.length > 0 && (
				<div className="space-y-1">
					{blockers.map((b) => (
						<div
							key={b}
							className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400"
						>
							<AlertTriangleIcon className="size-3 mt-0.5 shrink-0" />
							<span>{b}</span>
						</div>
					))}
				</div>
			)}

			{nextActions.length > 0 && (
				<div className="space-y-1">
					<div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
						<ListTodoIcon className="size-3" />
						待办
					</div>
					{nextActions.map((a) => (
						<div
							key={a}
							className="flex items-start gap-1.5 text-xs text-foreground/80"
						>
							<span className="text-muted-foreground mt-px">•</span>
							<span>{a}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
