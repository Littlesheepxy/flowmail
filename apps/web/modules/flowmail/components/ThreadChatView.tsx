"use client";

import { cn, Spinner } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DOMPurify from "isomorphic-dompurify";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	ClockIcon,
	DownloadIcon,
	FileIcon,
	FileTextIcon,
	ForwardIcon,
	ImageIcon,
	InboxIcon,
	MailIcon,
	PaperclipIcon,
	ReplyAllIcon,
	Reply as ReplyIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { EntityTimeline } from "./EntityTimeline";
import type { ReplyMode } from "./ReplyComposer";
import { ReplyComposer } from "./ReplyComposer";

const Letter = dynamic(() => import("react-letter").then((m) => m.Letter), {
	ssr: false,
});

interface ThreadChatViewProps {
	entityId: string | null;
}

export function ThreadChatView({ entityId }: ThreadChatViewProps) {
	const t = useTranslations("flowmail");
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

			const connectionId = (latestThread as { connectionId?: string })
				.connectionId;
			if (!connectionId) {
				toast.error(t("threadView.email.noConnection"));
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

			const messageId = (latestThread as { messageId?: string | null })
				.messageId;

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

				toast.success(t("threadView.email.sentSuccess"));
				setShowComposer(false);

				await queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.queryOptions({
						input: { entityId: entityId ?? "" },
					}).queryKey,
				});
			} catch (err) {
				toast.error(
					t("threadView.email.sendFailed", {
						error:
							err instanceof Error
								? err.message
								: t("common.error.unknown"),
					}),
				);
			}
		},
		[entity, entityId, sendMutation, queryClient, t],
	);

	const openComposer = useCallback((mode: ReplyMode) => {
		setComposerMode(mode);
		setShowComposer(true);
	}, []);

	if (!entityId) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
				<InboxIcon className="size-12 mb-3 stroke-1" />
				<p className="text-sm font-medium">
					{t("threadView.empty.selectThread.title")}
				</p>
				<p className="text-xs mt-1 text-muted-foreground/30">
					{t("threadView.empty.selectThread.subtitle")}
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
				{t("threadView.notFound")}
			</div>
		);
	}

	const threads = entity.threads ?? [];
	const timeline = entity.timeline ?? [];
	const latestThread = threads[0];

	return (
		<div className="flex flex-col h-full">
			<div className="px-5 py-3 border-b shrink-0">
				<h2 className="text-base font-semibold truncate">
					{entity.title}
				</h2>
				{entity.aiSummary && (
					<p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
						{entity.aiSummary}
					</p>
				)}
			</div>

			<Tabs
				defaultValue="emails"
				className="flex flex-col flex-1 min-h-0"
			>
				<div className="px-5 shrink-0">
					<TabsList className="w-full justify-start gap-0 border-b-0 bg-transparent">
						<TabsTrigger value="emails" className="gap-1.5 text-xs">
							<MailIcon className="size-3.5" />
							{t("threadView.tab.email")}
							{threads.length > 0 && (
								<span className="ml-0.5 text-[10px] text-muted-foreground">
									{threads.length}
								</span>
							)}
						</TabsTrigger>
						<TabsTrigger
							value="timeline"
							className="gap-1.5 text-xs"
						>
							<ClockIcon className="size-3.5" />
							{t("threadView.tab.timeline")}
							{timeline.length > 0 && (
								<span className="ml-0.5 text-[10px] text-muted-foreground">
									{timeline.length}
								</span>
							)}
						</TabsTrigger>
					</TabsList>
				</div>

				<TabsContent
					value="emails"
					className="flex-1 overflow-y-auto mt-0 min-h-0"
				>
					<EmailListView threads={threads} onReply={openComposer} />
				</TabsContent>

				<TabsContent
					value="timeline"
					className="flex-1 overflow-y-auto mt-0 min-h-0 px-5 py-4"
				>
					<EntityTimeline
						entityId={entity.id}
						entityTitle={entity.title}
						events={timeline.map((e) => ({
							...e,
							createdAt:
								typeof e.createdAt === "string"
									? e.createdAt
									: e.createdAt.toString(),
							actor: e.actor
								? {
										id: e.actor.id,
										name: e.actor.name ?? "",
										image: e.actor.image,
									}
								: null,
						}))}
						entityType={entity.type}
						status={entity.status}
						extractedFields={
							entity.extractedFields as string | null
						}
					/>
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
					defaultMode={composerMode}
					onSend={handleSend}
					onClose={() => setShowComposer(false)}
					isSending={sendMutation.isPending}
				/>
			)}

			{/* Bottom action buttons */}
			{!showComposer && threads.length > 0 && (
				<div className="border-t px-5 py-3 shrink-0 flex items-center gap-2">
					<Button
						variant="secondary"
						className="gap-2"
						onClick={() => openComposer("reply")}
					>
						<ReplyIcon className="size-4" />
						{t("threadView.action.reply")}
					</Button>
					<Button
						variant="secondary"
						className="gap-2"
						onClick={() => openComposer("forward")}
					>
						<ForwardIcon className="size-4" />
						{t("threadView.action.forward")}
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

function EmailListView({
	threads,
	onReply,
}: {
	threads: ThreadItem[];
	onReply?: (mode: ReplyMode) => void;
}) {
	const t = useTranslations("flowmail");
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
				<p className="text-sm font-medium">
					{t("threadView.empty.noRelatedEmails.title")}
				</p>
				<p className="text-xs mt-1 text-muted-foreground/30">
					{t("threadView.empty.noRelatedEmails.subtitle")}
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
	onReply?: (mode: ReplyMode) => void;
}) {
	const t = useTranslations("flowmail");
	const displayName = thread.senderName || thread.sender || "Unknown";
	const emailAddress = thread.sender || "";
	const initial = displayName.charAt(0).toUpperCase();
	const attachments = thread.attachments ?? [];
	const hasAttachments = attachments.length > 0;

	const toRecipients = useMemo(
		() => parseRecipients(thread.toRecipients),
		[thread.toRecipients],
	);
	const ccRecipients = useMemo(
		() => parseRecipients(thread.ccRecipients),
		[thread.ccRecipients],
	);

	return (
		<div
			className={cn(
				"transition-colors",
				isExpanded ? "bg-background" : "hover:bg-muted/30",
			)}
		>
			{/* Message Header - always visible */}
			{/* biome-ignore lint/a11y/useSemanticElements: cannot use <button> here because it would nest inside other buttons */}
			<div
				role="button"
				tabIndex={0}
				aria-expanded={isExpanded}
				onClick={onToggle}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						onToggle();
					}
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
							{formatRelativeTime(thread.receivedAt, t)}
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
										<Button
											variant="secondary"
											size="sm"
											className="h-7 px-2.5 gap-1.5 text-xs"
											onClick={(e) => {
												e.stopPropagation();
												onReply?.("reply");
											}}
										>
											<ReplyIcon className="size-3.5" />
											{t("threadView.action.reply")}
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										{t("threadView.action.reply")}
									</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="secondary"
											size="sm"
											className="h-7 px-2.5 gap-1.5 text-xs"
											onClick={(e) => {
												e.stopPropagation();
												onReply?.("replyAll");
											}}
										>
											<ReplyAllIcon className="size-3.5" />
											{t("threadView.action.replyAll")}
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										{t("threadView.action.replyAll")}
									</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="secondary"
											size="sm"
											className="h-7 px-2.5 gap-1.5 text-xs"
											onClick={(e) => {
												e.stopPropagation();
												onReply?.("forward");
											}}
										>
											<ForwardIcon className="size-3.5" />
											{t("threadView.action.forward")}
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										{t("threadView.action.forward")}
									</TooltipContent>
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

function RecipientLine({
	to,
	cc,
}: {
	to: EmailRecipient[];
	cc: EmailRecipient[];
}) {
	const t = useTranslations("flowmail");
	const [expanded, setExpanded] = useState(false);
	const totalCount = to.length + cc.length;

	if (totalCount === 0) {
		return null;
	}

	const firstTo = to[0];
	const remaining = totalCount - 1;

	return (
		<div className="text-xs text-muted-foreground mt-0.5">
			<span>{t("threadView.recipient.toPrefix")}</span>
			<span className="text-foreground/70">
				{firstTo?.name || firstTo?.address}
			</span>
			{remaining > 0 && !expanded && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						setExpanded(true);
					}}
					className="ml-1 text-primary hover:underline"
				>
					{t("threadView.recipient.morePeople", {
						count: remaining,
					})}
				</button>
			)}
			{expanded && (
				<span>
					{to.slice(1).map((r) => (
						<span key={r.address}>
							,{" "}
							<span className="text-foreground/70">
								{r.name || r.address}
							</span>
						</span>
					))}
					{cc.length > 0 && (
						<span className="ml-1">
							| {t("threadView.recipient.ccPrefix")}{" "}
							{cc.map((r) => r.name || r.address).join(", ")}
						</span>
					)}
				</span>
			)}
		</div>
	);
}

// ─── Email Body ───

function EmailBody({ thread }: { thread: ThreadItem }) {
	const t = useTranslations("flowmail");
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
						{t("threadView.quote.expand")}
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
		<p className="text-sm text-muted-foreground italic">
			{t("threadView.preview.empty")}
		</p>
	);
}

// ─── Attachment Bar ───

function AttachmentBar({ attachments }: { attachments: AttachmentItem[] }) {
	const t = useTranslations("flowmail");
	const [expanded, setExpanded] = useState(false);
	const visible = expanded ? attachments : attachments.slice(0, 3);

	return (
		<div className="mt-4 pt-3 border-t">
			<div className="flex items-center gap-2 mb-2">
				<PaperclipIcon className="size-3.5 text-muted-foreground" />
				<span className="text-xs font-medium text-muted-foreground">
					{t("threadView.attachment.count", {
						count: attachments.length,
					})}
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
					{t("threadView.attachment.showAll", {
						count: attachments.length,
					})}
				</button>
			)}
		</div>
	);
}

function AttachmentChip({ attachment }: { attachment: AttachmentItem }) {
	const t = useTranslations("flowmail");
	const Icon = getFileIcon(attachment.mimeType);
	const sizeStr = attachment.size ? formatFileSize(attachment.size) : "";

	return (
		<div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors group max-w-[240px]">
			<Icon className="size-4 text-muted-foreground shrink-0" />
			<div className="flex-1 min-w-0">
				<p className="text-xs font-medium truncate">
					{attachment.filename}
				</p>
				{sizeStr && (
					<p className="text-[10px] text-muted-foreground">
						{sizeStr}
					</p>
				)}
			</div>
			<button
				type="button"
				className="size-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-background transition-all"
				title={t("threadView.attachment.download")}
			>
				<DownloadIcon className="size-3.5 text-muted-foreground" />
			</button>
		</div>
	);
}

// ─── Utilities ───

function formatRelativeTime(
	date: string | Date,
	t: ReturnType<typeof useTranslations>,
): string {
	const d = new Date(date);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) {
		return t("time.justNow");
	}
	if (diffMins < 60) {
		return t("time.minutesAgo", { count: diffMins });
	}
	if (diffHours < 24) {
		return t("time.hoursAgo", { count: diffHours });
	}
	if (diffDays < 7) {
		return t("time.daysAgo", { count: diffDays });
	}

	const isSameYear = d.getFullYear() === now.getFullYear();
	if (isSameYear) {
		return t("time.dateSameYear", {
			month: d.getMonth() + 1,
			day: d.getDate(),
			hour: pad(d.getHours()),
			minute: pad(d.getMinutes()),
		});
	}
	return t("time.dateOtherYear", {
		year: d.getFullYear(),
		month: d.getMonth() + 1,
		day: d.getDate(),
	});
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
