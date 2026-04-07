"use client";

import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TiptapUnderline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	BoldIcon,
	ForwardIcon,
	ItalicIcon,
	LinkIcon,
	ListIcon,
	ListOrderedIcon,
	PaperclipIcon,
	QuoteIcon,
	ReplyAllIcon,
	Reply as ReplyIcon,
	SendIcon,
	UnderlineIcon,
	XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

export type ReplyMode = "reply" | "replyAll" | "forward";

interface ReplyComposerProps {
	senderName?: string;
	senderEmail: string;
	subject: string;
	toRecipients?: Array<{ name?: string; address: string }>;
	ccRecipients?: Array<{ name?: string; address: string }>;
	defaultMode?: ReplyMode;
	onSend?: (data: {
		mode: ReplyMode;
		html: string;
		text: string;
	}) => void | Promise<void>;
	onClose?: () => void;
	isSending?: boolean;
	className?: string;
}

export function ReplyComposer({
	senderName,
	senderEmail,
	subject,
	toRecipients,
	ccRecipients,
	defaultMode = "reply",
	onSend,
	onClose,
	isSending: externalSending,
	className,
}: ReplyComposerProps) {
	const t = useTranslations("flowmail");
	const [mode, setMode] = useState<ReplyMode>(defaultMode);
	const [internalSending, setInternalSending] = useState(false);
	const isSending = externalSending ?? internalSending;

	const editor = useEditor(
		{
			immediatelyRender: false,
			extensions: [
				StarterKit.configure({ heading: { levels: [2, 3] } }),
				TiptapUnderline,
				TiptapLink.configure({
					openOnClick: false,
					HTMLAttributes: { class: "text-primary underline" },
				}),
				Placeholder.configure({
					placeholder: t("replyComposer.placeholder"),
				}),
			],
			editorProps: {
				attributes: {
					class: "prose prose-sm dark:prose-invert max-w-none min-h-[160px] overflow-y-auto px-4 py-3 text-sm outline-none",
				},
			},
		},
		[t],
	);

	const recipientDisplay =
		mode === "reply"
			? `${senderName || senderEmail}`
			: mode === "replyAll"
				? [
						senderName || senderEmail,
						...(toRecipients?.map((r) => r.name || r.address) ??
							[]),
						...(ccRecipients?.map((r) => r.name || r.address) ??
							[]),
					]
						.filter(Boolean)
						.join(", ")
				: "";

	const subjectPrefix = mode === "forward" ? "Fwd: " : "Re: ";
	const displaySubject =
		subject.startsWith("Re:") || subject.startsWith("Fwd:")
			? subject
			: `${subjectPrefix}${subject}`;

	const handleSend = useCallback(async () => {
		if (!editor) {
			return;
		}
		setInternalSending(true);
		try {
			const html = editor.getHTML();
			const text = editor.getText();
			await onSend?.({ mode, html, text });
		} finally {
			setInternalSending(false);
		}
	}, [editor, mode, onSend]);

	const modeIcon =
		mode === "reply"
			? ReplyIcon
			: mode === "replyAll"
				? ReplyAllIcon
				: ForwardIcon;
	const ModeIcon = modeIcon;

	return (
		<div className={cn("border-t bg-background shrink-0", className)}>
			{/* Header: mode icon + recipient + close */}
			<div className="flex items-center gap-2 px-4 py-2.5 border-b">
				<div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
					<ModeIcon className="size-3.5" />
					<span className="text-xs font-medium">
						{mode === "reply"
							? t("replyComposer.mode.reply")
							: mode === "replyAll"
								? t("replyComposer.mode.replyAll")
								: t("replyComposer.mode.forward")}
					</span>
				</div>

				<span className="text-sm text-foreground truncate flex-1">
					{mode === "forward" ? displaySubject : recipientDisplay}
				</span>

				{/* Mode switcher */}
				<div className="flex items-center gap-0.5 shrink-0">
					<ModeButton
						active={mode === "reply"}
						onClick={() => setMode("reply")}
						icon={ReplyIcon}
						label={t("replyComposer.mode.reply")}
					/>
					<ModeButton
						active={mode === "replyAll"}
						onClick={() => setMode("replyAll")}
						icon={ReplyAllIcon}
						label={t("replyComposer.mode.replyAll")}
					/>
					<ModeButton
						active={mode === "forward"}
						onClick={() => setMode("forward")}
						icon={ForwardIcon}
						label={t("replyComposer.mode.forward")}
					/>
				</div>

				{onClose && (
					<button
						type="button"
						onClick={onClose}
						className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
					>
						<XIcon className="size-3.5" />
					</button>
				)}
			</div>

			{/* Editor area */}
			<EditorContent editor={editor} />

			{/* Bottom toolbar — Gmail style: send left, format tools right */}
			<div className="flex items-center gap-2 px-3 py-2.5 border-t">
				{/* Send button */}
				<Button
					className="gap-2 shrink-0"
					onClick={handleSend}
					disabled={isSending || !editor?.getText().trim()}
				>
					<SendIcon className="size-4" />
					{t("replyComposer.action.send")}
				</Button>

				<div className="w-px h-5 bg-border mx-1 shrink-0" />

				{/* Format toolbar */}
				<div className="flex items-center gap-0.5 flex-1">
					<ToolbarButton
						onClick={() =>
							editor?.chain().focus().toggleBold().run()
						}
						active={editor?.isActive("bold")}
						icon={BoldIcon}
						title={t("replyComposer.format.bold")}
					/>
					<ToolbarButton
						onClick={() =>
							editor?.chain().focus().toggleItalic().run()
						}
						active={editor?.isActive("italic")}
						icon={ItalicIcon}
						title={t("replyComposer.format.italic")}
					/>
					<ToolbarButton
						onClick={() =>
							editor?.chain().focus().toggleUnderline().run()
						}
						active={editor?.isActive("underline")}
						icon={UnderlineIcon}
						title={t("replyComposer.format.underline")}
					/>
					<div className="w-px h-4 bg-border mx-1" />
					<ToolbarButton
						onClick={() =>
							editor?.chain().focus().toggleBulletList().run()
						}
						active={editor?.isActive("bulletList")}
						icon={ListIcon}
						title={t("replyComposer.format.bulletList")}
					/>
					<ToolbarButton
						onClick={() =>
							editor?.chain().focus().toggleOrderedList().run()
						}
						active={editor?.isActive("orderedList")}
						icon={ListOrderedIcon}
						title={t("replyComposer.format.orderedList")}
					/>
					<ToolbarButton
						onClick={() =>
							editor?.chain().focus().toggleBlockquote().run()
						}
						active={editor?.isActive("blockquote")}
						icon={QuoteIcon}
						title={t("replyComposer.format.blockquote")}
					/>
					<div className="w-px h-4 bg-border mx-1" />
					<ToolbarButton
						onClick={() => {
							const url = window.prompt(
								t("replyComposer.format.linkPrompt"),
							);
							if (url) {
								editor
									?.chain()
									.focus()
									.setLink({ href: url })
									.run();
							}
						}}
						active={editor?.isActive("link")}
						icon={LinkIcon}
						title={t("replyComposer.format.insertLink")}
					/>
					<ToolbarButton
						onClick={() => {}}
						icon={PaperclipIcon}
						disabled
						title={t("replyComposer.attachmentComingSoon")}
					/>
				</div>
			</div>
		</div>
	);
}

function ModeButton({
	active,
	onClick,
	icon: Icon,
	label,
}: {
	active: boolean;
	onClick: () => void;
	icon: typeof ReplyIcon;
	label: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
				active
					? "bg-muted text-foreground"
					: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
			)}
		>
			<Icon className="size-3" />
			{label}
		</button>
	);
}

function ToolbarButton({
	onClick,
	active,
	icon: Icon,
	disabled,
	title,
}: {
	onClick: () => void;
	active?: boolean;
	icon: typeof BoldIcon;
	disabled?: boolean;
	title?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={title}
			className={cn(
				"size-7 flex items-center justify-center rounded transition-colors",
				active
					? "bg-muted text-foreground"
					: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
				disabled && "opacity-40 cursor-not-allowed",
			)}
		>
			<Icon className="size-3.5" />
		</button>
	);
}
