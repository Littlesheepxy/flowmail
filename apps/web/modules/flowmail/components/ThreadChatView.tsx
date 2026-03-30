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
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import {
	InboxIcon,
	MailIcon,
	ClockIcon,
	AlertCircleIcon,
	CheckCircle2Icon,
	BotIcon,
	UserIcon,
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
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { ReplyComposer } from "./ReplyComposer";

const Letter = dynamic(() => import("react-letter").then((m) => m.Letter), {
	ssr: false,
});

interface ThreadChatViewProps {
	entityId: string | null;
}

const TIMELINE_ICONS: Record<string, typeof MailIcon> = {
	email_received: MailIcon,
	status_changed: AlertCircleIcon,
	action_taken: CheckCircle2Icon,
	ai_summary: BotIcon,
};

const TIMELINE_LABELS: Record<string, string> = {
	email_received: "收到邮件",
	status_changed: "状态变更",
	action_taken: "执行操作",
	ai_summary: "AI 分析",
};

export function ThreadChatView({ entityId }: ThreadChatViewProps) {
	const { data: entity, isLoading } = useQuery({
		...orpc.flowEntities.get.queryOptions({
			input: { entityId: entityId ?? "" },
		}),
		enabled: !!entityId,
	});
	const [showComposer, setShowComposer] = useState(false);

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

	return (
		<div className="flex flex-col h-full">
			<div className="px-5 py-3 border-b shrink-0">
				<h2 className="text-base font-semibold truncate">{entity.title}</h2>
				{entity.aiSummary && (
					<p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
						{entity.aiSummary}
					</p>
				)}
			</div>

		<Tabs defaultValue="emails" className="flex flex-col flex-1 min-h-0">
			<div className="px-5 shrink-0">
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
					<TabsTrigger value="timeline" className="gap-1.5 text-xs">
						<ClockIcon className="size-3.5" />
						时间线
						{timeline.length > 0 && (
							<span className="ml-0.5 text-[10px] text-muted-foreground">
								{timeline.length}
							</span>
						)}
					</TabsTrigger>
				</TabsList>
			</div>

			<TabsContent value="emails" className="flex-1 overflow-y-auto mt-0 min-h-0">
				<EmailListView threads={threads} onReply={() => setShowComposer(true)} />
			</TabsContent>

			<TabsContent value="timeline" className="flex-1 overflow-y-auto mt-0 min-h-0 px-5 py-4">
				<TimelineView timeline={timeline} />
			</TabsContent>
		</Tabs>

		{/* Reply Composer */}
		{showComposer && latestThread && (
			<ReplyComposer
				senderName={latestThread.senderName ?? undefined}
				senderEmail={latestThread.sender ?? ""}
				subject={latestThread.subject ?? ""}
				toRecipients={parseRecipients(latestThread.toRecipients)}
				ccRecipients={parseRecipients(latestThread.ccRecipients)}
				onClose={() => setShowComposer(false)}
			/>
		)}

		{/* Bottom action buttons */}
		{!showComposer && threads.length > 0 && (
			<div className="border-t px-5 py-3 shrink-0 flex items-center gap-2">
				<Button
					variant="secondary"
					className="gap-2"
					onClick={() => setShowComposer(true)}
				>
					<ReplyIcon className="size-4" />
					回复
				</Button>
				<Button
					variant="secondary"
					className="gap-2"
					onClick={() => setShowComposer(true)}
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

function EmailListView({ threads, onReply }: { threads: ThreadItem[]; onReply?: () => void }) {
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

	return (
		<div className="divide-y">
			{threads.map((thread) => {
				const isExpanded = expandedIds.has(thread.id);
				return (
					<EmailMessage
						key={thread.id}
						thread={thread}
						isExpanded={isExpanded}
						onToggle={() => toggleExpand(thread.id)}
						onReply={onReply}
					/>
				);
			})}
		</div>
	);
}

// ─── Single Email Message ───

function EmailMessage({
	thread,
	isExpanded,
	onToggle,
	onReply,
}: {
	thread: ThreadItem;
	isExpanded: boolean;
	onToggle: () => void;
	onReply?: () => void;
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
			{/* Message Header - always visible */}
			{/* biome-ignore lint/a11y/useSemanticElements: cannot use <button> here because it would nest inside other buttons */}
			<div
				role="button"
				tabIndex={0}
				aria-expanded={isExpanded}
				onClick={onToggle}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") { onToggle(); }
				}}
				className="w-full text-left px-5 py-3.5 flex items-start gap-3 cursor-pointer"
			>
				<div className="size-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold mt-0.5">
					{initial}
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
									<Button variant="secondary" size="sm" className="h-7 px-2.5 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); onReply?.(); }}>
										<ReplyIcon className="size-3.5" />
										回复
									</Button>
								</TooltipTrigger>
								<TooltipContent>回复</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="secondary" size="sm" className="h-7 px-2.5 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); onReply?.(); }}>
										<ReplyAllIcon className="size-3.5" />
										全部回复
									</Button>
								</TooltipTrigger>
								<TooltipContent>全部回复</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="secondary" size="sm" className="h-7 px-2.5 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); onReply?.(); }}>
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
				<div className="px-5 pb-5">
					{/* Email Body */}
					<div className="max-w-[680px] mx-auto">
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
		return (
			<div className="email-body-wrapper">
				<div className={cn("email-body", !showQuoted && "hide-quoted")}>
					<Letter html={thread.bodyHtml} />
				</div>
				{thread.bodyHtml.includes("blockquote") && !showQuoted && (
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

	return (
		<div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors group max-w-[240px]">
			<Icon className="size-4 text-muted-foreground shrink-0" />
			<div className="flex-1 min-w-0">
				<p className="text-xs font-medium truncate">{attachment.filename}</p>
				{sizeStr && (
					<p className="text-[10px] text-muted-foreground">{sizeStr}</p>
				)}
			</div>
			<button
				type="button"
				className="size-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-background transition-all"
				title="下载"
			>
				<DownloadIcon className="size-3.5 text-muted-foreground" />
			</button>
		</div>
	);
}

// ─── Timeline ───

interface TimelineEventItem {
	id: string;
	type: string;
	content: string;
	metadata?: string | null;
	createdAt: string | Date;
	actor?: { id: string; name: string | null; image: string | null } | null;
}

function TimelineView({ timeline }: { timeline: TimelineEventItem[] }) {
	if (timeline.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
				<ClockIcon className="size-10 mb-3 stroke-1" />
				<p className="text-sm font-medium">暂无时间线事件</p>
				<p className="text-xs mt-1 text-muted-foreground/30">
					操作和状态变更会自动记录
				</p>
			</div>
		);
	}

	return (
		<div className="relative">
			<div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" />

			<div className="space-y-0">
				{timeline.map((event, index) => {
					const Icon = TIMELINE_ICONS[event.type] ?? ClockIcon;
					const label = TIMELINE_LABELS[event.type] ?? event.type;
					const isLast = index === timeline.length - 1;
					const meta = parseMetadata(event.metadata);

					return (
						<div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
							<div className={cn(
								"relative z-10 flex size-[30px] shrink-0 items-center justify-center rounded-full border",
								event.type === "status_changed"
									? "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30"
									: event.type === "action_taken"
										? "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30"
										: event.type === "ai_summary"
											? "bg-violet-50 border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/30"
											: "bg-background border-border",
							)}>
								<Icon className={cn(
									"size-3.5",
									event.type === "status_changed"
										? "text-amber-600 dark:text-amber-400"
										: event.type === "action_taken"
											? "text-emerald-600 dark:text-emerald-400"
											: event.type === "ai_summary"
												? "text-violet-600 dark:text-violet-400"
												: "text-muted-foreground",
								)} />
							</div>

							<div className={cn("flex-1 min-w-0", !isLast && "pb-0")}>
								<div className="flex items-center gap-2 mb-0.5">
									<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
										{label}
									</span>
									<span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">
										{formatDate(event.createdAt)}
									</span>
								</div>

								<p className="text-sm leading-relaxed">{event.content}</p>

								{meta.previousStatus && meta.newStatus && (
									<div className="mt-1.5 flex items-center gap-1.5 text-xs">
										<span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
											{meta.previousStatus}
										</span>
										<span className="text-muted-foreground">→</span>
										<span className={cn(
											"px-1.5 py-0.5 rounded",
											meta.newStatus === "approved"
												? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
												: meta.newStatus === "rejected"
													? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
													: "bg-primary/10 text-primary",
										)}>
											{meta.newStatus}
										</span>
									</div>
								)}

								{event.actor?.name && (
									<div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
										<UserIcon className="size-3" />
										<span>{event.actor.name}</span>
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
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

function parseMetadata(raw?: string | null): Record<string, string> {
	if (!raw) {
		return {};
	}
	try {
		return JSON.parse(raw);
	} catch {
		return {};
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
