"use client";

import { cn } from "@repo/ui";
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
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowRightIcon,
	BrainIcon,
	CalendarIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	ClockIcon,
	FolderIcon,
	GavelIcon,
	InboxIcon,
	LightbulbIcon,
	MailIcon,
	MessageSquareIcon,
	PencilIcon,
	RefreshCwIcon,
	SettingsIcon,
	SparklesIcon,
	Trash2Icon,
	UserCircleIcon,
	UserIcon,
	ZapIcon,
} from "lucide-react";
import { useState } from "react";

const TYPE_CONFIG: Record<
	string,
	{
		label: string;
		icon: typeof BrainIcon;
		color: string;
		bgColor: string;
		fieldLabels: Record<string, string>;
	}
> = {
	self: {
		label: "我的画像",
		icon: UserCircleIcon,
		color: "text-violet-500",
		bgColor: "bg-violet-500/10",
		fieldLabels: {
			role: "角色",
			writing_style: "写作风格",
			sample_emails: "参照邮件",
			reply_patterns: "回复模式",
			work_habits: "工作习惯",
			tone_preference: "语气偏好",
			signature: "签名",
			language: "语言",
			processing_preferences: "处理偏好",
		},
	},
	person: {
		label: "联系人",
		icon: UserIcon,
		color: "text-blue-500",
		bgColor: "bg-blue-500/10",
		fieldLabels: {
			role: "职务",
			company: "公司",
			communication_style: "沟通风格",
			sample_interactions: "典型对话",
			sensitivity: "敏感点",
			relationship: "关系",
			preferences: "偏好",
			habits: "习惯",
		},
	},
	project: {
		label: "项目",
		icon: FolderIcon,
		color: "text-emerald-500",
		bgColor: "bg-emerald-500/10",
		fieldLabels: {
			status: "状态",
			deadline: "截止日期",
			owner: "负责人",
			participants: "参与者",
			progress: "进展",
			budget: "预算",
			key_context: "关键背景",
		},
	},
	event: {
		label: "事件",
		icon: CalendarIcon,
		color: "text-amber-500",
		bgColor: "bg-amber-500/10",
		fieldLabels: {
			happened_at: "发生时间",
			participants: "相关人",
			impact: "影响",
			follow_up: "后续动作",
			related_project: "关联项目",
		},
	},
	preference: {
		label: "规则偏好",
		icon: SettingsIcon,
		color: "text-cyan-500",
		bgColor: "bg-cyan-500/10",
		fieldLabels: {
			rule: "规则",
			context: "适用场景",
			scope: "适用范围",
			examples: "示例",
		},
	},
	decision: {
		label: "决策记录",
		icon: GavelIcon,
		color: "text-rose-500",
		bgColor: "bg-rose-500/10",
		fieldLabels: {
			decision: "决策",
			reason: "原因",
			context: "背景",
			outcome: "结果",
			decided_at: "决定时间",
			related_entities: "关联事项",
		},
	},
};

const ALL_TYPES = [
	"self",
	"person",
	"project",
	"event",
	"preference",
	"decision",
] as const;
const LONG_VALUE_THRESHOLD = 50;

interface MemoryManagerPanelProps {
	organizationId: string;
}

export function MemoryManagerPanel({
	organizationId,
}: MemoryManagerPanelProps) {
	const [selectedType, setSelectedType] = useState<string | undefined>();
	const [editingField, setEditingField] = useState<{
		objectId: string;
		key: string;
		value: string;
		isLong: boolean;
	} | null>(null);

	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery(
		orpc.memory.listObjects.queryOptions({
			input: { organizationId, objectType: selectedType },
		}),
	);

	const deleteMutation = useMutation(
		orpc.memory.deleteObject.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.memory.listObjects.queryOptions({
						input: { organizationId },
					}).queryKey,
				});
			},
		}),
	);

	const updateAttrMutation = useMutation(
		orpc.memory.updateObjectAttribute.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.memory.listObjects.queryOptions({
						input: { organizationId },
					}).queryKey,
				});
				setEditingField(null);
			},
		}),
	);

	const objects = data?.items ?? [];

	const selfObjects = objects.filter((o) => o.objectType === "self");
	const otherObjects = objects.filter((o) => o.objectType !== "self");
	const sortedObjects =
		selectedType === "self"
			? selfObjects
			: [...selfObjects, ...otherObjects];
	const displayObjects = selectedType ? objects : sortedObjects;

	return (
		<div className="space-y-4">
			{/* Type filter tabs */}
			<div className="flex flex-wrap gap-1.5">
				<button
					type="button"
					onClick={() => setSelectedType(undefined)}
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all",
						!selectedType
							? "bg-primary text-primary-foreground font-medium"
							: "bg-muted text-muted-foreground hover:bg-muted/80",
					)}
				>
					<BrainIcon className="size-3" />
					全部
				</button>
				{ALL_TYPES.map((type) => {
					const cfg = TYPE_CONFIG[type];
					if (!cfg) {
						return null;
					}
					const Icon = cfg.icon;
					return (
						<button
							key={type}
							type="button"
							onClick={() =>
								setSelectedType(
									selectedType === type ? undefined : type,
								)
							}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all",
								selectedType === type
									? "bg-primary text-primary-foreground font-medium"
									: "bg-muted text-muted-foreground hover:bg-muted/80",
							)}
						>
							<Icon className="size-3" />
							{cfg.label}
						</button>
					);
				})}
			</div>

			{/* Stats */}
			{(data?.total ?? 0) > 0 && (
				<div className="text-xs text-muted-foreground">
					共 {data?.total ?? 0} 个记忆对象
					{selectedType &&
						` · 筛选: ${TYPE_CONFIG[selectedType]?.label}`}
				</div>
			)}

			{/* Content */}
			{isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={`skel-${i}`}
							className="rounded-lg border p-4 animate-pulse"
						>
							<div className="h-4 bg-muted rounded w-32 mb-3" />
							<div className="h-3 bg-muted rounded w-full mb-2" />
							<div className="h-3 bg-muted rounded w-3/4" />
						</div>
					))}
				</div>
			) : displayObjects.length === 0 ? (
				<MemoryEmptyState />
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
					{displayObjects.map((obj) => (
						<ObjectCard
							key={obj.id}
							object={obj}
							onEditField={(key, value, isLong) =>
								setEditingField({
									objectId: obj.id,
									key,
									value: String(value),
									isLong,
								})
							}
							onDelete={() =>
								deleteMutation.mutate({ objectId: obj.id })
							}
						/>
					))}
				</div>
			)}

			{/* Edit field dialog */}
			<Dialog
				open={!!editingField}
				onOpenChange={(open) => !open && setEditingField(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>编辑属性</DialogTitle>
					</DialogHeader>
					{editingField?.isLong ? (
						<Textarea
							value={editingField.value}
							onChange={(e) =>
								setEditingField({
									...editingField,
									value: e.target.value,
								})
							}
							rows={6}
							className="resize-y"
						/>
					) : (
						<Input
							value={editingField?.value ?? ""}
							onChange={(e) =>
								editingField &&
								setEditingField({
									...editingField,
									value: e.target.value,
								})
							}
						/>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setEditingField(null)}
						>
							取消
						</Button>
						<Button
							onClick={() => {
								if (editingField?.value.trim()) {
									updateAttrMutation.mutate({
										objectId: editingField.objectId,
										key: editingField.key,
										value: editingField.value.trim(),
									});
								}
							}}
							disabled={updateAttrMutation.isPending}
						>
							保存
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ─── Object Card ───

interface ObjectCardProps {
	object: {
		id: string;
		objectType: string;
		objectId: string;
		name: string;
		attributes: Record<string, unknown>;
		relations: unknown[] | null;
		changeLogCount: number;
		lastUpdatedAt: string;
		createdAt: string;
	};
	onEditField: (key: string, value: unknown, isLong: boolean) => void;
	onDelete: () => void;
}

function ObjectCard({ object, onEditField, onDelete }: ObjectCardProps) {
	const [historyOpen, setHistoryOpen] = useState(false);
	const cfg = TYPE_CONFIG[object.objectType] ?? {
		label: object.objectType,
		icon: BrainIcon,
		color: "text-muted-foreground",
		bgColor: "bg-muted",
		fieldLabels: {},
	};
	const Icon = cfg.icon;
	const attrs = object.attributes;
	const fieldLabels = cfg.fieldLabels;

	const shortFields: [string, unknown][] = [];
	const longFields: [string, unknown][] = [];

	for (const [key, value] of Object.entries(attrs)) {
		if (value == null || value === "") {
			continue;
		}
		const str = formatValue(value);
		if (str.length >= LONG_VALUE_THRESHOLD || str.includes("\n")) {
			longFields.push([key, value]);
		} else {
			shortFields.push([key, value]);
		}
	}

	return (
		<div className="group rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
			{/* Header */}
			<div className="px-4 pt-4 pb-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2.5 min-w-0">
						<div className={cn("size-8 rounded-xl flex items-center justify-center shrink-0", cfg.bgColor)}>
							<Icon className={cn("size-4", cfg.color)} />
						</div>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<h3 className="text-sm font-semibold truncate">{object.name}</h3>
								<span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", cfg.bgColor, cfg.color)}>
									{cfg.label}
								</span>
							</div>
							{object.objectType !== "self" && object.objectId !== object.name && (
								<p className="text-[11px] text-muted-foreground mt-0.5 truncate">{object.objectId}</p>
							)}
						</div>
					</div>
					<div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive">
									<Trash2Icon className="size-3.5" />
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>删除记忆对象</AlertDialogTitle>
									<AlertDialogDescription>
										确定删除「{object.name}」？AI 将不再使用此信息，但历史记忆会保留。
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
			</div>

			{/* Attributes */}
			{(shortFields.length > 0 || longFields.length > 0) && (
				<div className="px-4 pb-3 space-y-2">
					{shortFields.map(([key, value]) => (
						<div key={key} className="flex items-baseline gap-2 group/field">
							<span className="text-[11px] text-muted-foreground/70 shrink-0 min-w-16">
								{fieldLabels[key] ?? key}
							</span>
							<span className="text-[13px] flex-1 min-w-0 wrap-break-word">{formatValue(value)}</span>
							<button
								type="button"
								className="opacity-0 group-hover/field:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-muted"
								onClick={() => onEditField(key, formatValue(value), false)}
							>
								<PencilIcon className="size-3 text-muted-foreground" />
							</button>
						</div>
					))}
					{longFields.map(([key, value]) => (
						<LongFieldBlock
							key={key}
							label={fieldLabels[key] ?? key}
							value={formatValue(value)}
							onEdit={() => onEditField(key, formatValue(value), true)}
						/>
					))}
				</div>
			)}

			{/* Relations */}
			{object.relations && object.relations.length > 0 && (
				<div className="px-4 pb-3">
					<div className="flex flex-wrap gap-1.5">
						<span className="text-[11px] text-muted-foreground/70 leading-5">关联</span>
						{(object.relations as Array<{ label?: string; targetId?: string }>)
							.map((r) => r.label ?? r.targetId ?? "")
							.filter(Boolean)
							.map((name) => (
								<span key={name} className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
									{name}
								</span>
							))}
					</div>
				</div>
			)}

			{/* Footer */}
			<div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 mt-auto">
				<span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
					<ClockIcon className="size-3" />
					{new Date(object.lastUpdatedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
				</span>
				{object.changeLogCount > 0 && (
					<button
						type="button"
						onClick={() => setHistoryOpen(!historyOpen)}
						className={cn(
							"inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition-colors",
							historyOpen
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
					>
						{object.changeLogCount} 条变更
						{historyOpen ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
					</button>
				)}
			</div>

			{/* Change log */}
			{historyOpen && <ObjectHistory objectId={object.id} />}
		</div>
	);
}

// ─── Long Field Block ───

function LongFieldBlock({
	label,
	value,
	onEdit,
}: {
	label: string;
	value: string;
	onEdit: () => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const lines = value.split("\n");
	const isOverflow = lines.length > 3 || value.length > 200;

	return (
		<div className="group/field">
			<div className="flex items-center justify-between mb-1">
				<span className="text-[11px] text-muted-foreground/70 font-medium">{label}</span>
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						className="opacity-0 group-hover/field:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
						onClick={onEdit}
					>
						<PencilIcon className="size-3 text-muted-foreground" />
					</button>
					{isOverflow && (
						<button
							type="button"
							onClick={() => setExpanded(!expanded)}
							className="text-[11px] text-primary/70 hover:text-primary transition-colors"
						>
							{expanded ? "收起" : "展开"}
						</button>
					)}
				</div>
			</div>
			<div className="rounded-lg bg-muted/40 px-3 py-2">
				<p className={cn(
					"text-[13px] leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground/80",
					!expanded && isOverflow && "line-clamp-3",
				)}>
					{value}
				</p>
			</div>
		</div>
	);
}

// ─── Object History (lazy loaded) ───

function ObjectHistory({ objectId }: { objectId: string }) {
	const { data, isLoading } = useQuery(
		orpc.memory.getObjectHistory.queryOptions({
			input: { objectId, limit: 10 },
		}),
	);

	if (isLoading) {
		return (
			<div className="px-4 py-3 border-t bg-muted/20">
				<div className="h-3 bg-muted rounded w-48 animate-pulse" />
			</div>
		);
	}

	const items = data?.items ?? [];
	if (items.length === 0) {
		return null;
	}

	return (
		<div className="px-4 py-3 border-t bg-muted/20">
			<div className="relative space-y-3 pl-4 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-border">
				{items.map((log) => {
					const lines = log.content.split("\n");
					const title = lines[0];
					const details = lines.slice(1);
					return (
						<div key={log.id} className="relative">
							<div className="absolute left-[-13px] top-1.5 size-2 rounded-full bg-violet-400 ring-2 ring-background" />
							<p className="text-[12px] font-medium text-foreground/80">{title}</p>
							{details.length > 0 && (
								<div className="mt-1 space-y-0.5">
									{details.map((line) => (
										<p key={line} className="text-[11px] text-muted-foreground leading-relaxed font-mono">
											{line}
										</p>
									))}
								</div>
							)}
							<p className="text-[10px] text-muted-foreground/50 mt-1">
								{new Date(log.createdAt).toLocaleDateString("zh-CN", {
									month: "short",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</p>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// ─── Helpers ───

function formatValue(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(String).join("、");
	}
	if (typeof value === "object" && value !== null) {
		return Object.entries(value)
			.map(([k, v]) => `${k}: ${v}`)
			.join("\n");
	}
	return String(value);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ─── Empty State ───
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DemoObject {
	objectType: string;
	name: string;
	objectId?: string;
	attributes: Record<string, string>;
	changeLogs: { title: string; details?: string[]; time: string }[];
}

const DEMO_OBJECTS: DemoObject[] = [
	{
		objectType: "self",
		name: "我的画像",
		attributes: {
			role: "投资总监 · 关注硬科技和 AI 赛道",
			writing_style:
				"偏好简体中文回复，语气专业但不生硬。开头用「Hi + 名字」，结尾用「Best regards」。段落简短，重点加粗。不喜欢冗长的客套话，一封邮件不超过 5 句话。",
			sample_emails:
				'📧 审批回复（同意）：\n"Hi 张伟，\n采购申请已审批通过，请按流程推进。如有变更请提前告知。\nBest regards, Yang"\n\n📧 审批回复（需补充）：\n"Hi 张伟，\n这笔采购金额超过预算阈值，麻烦补充一份 ROI 分析再提交。\nBest regards, Yang"\n\n📧 汇报回复：\n"Hi 李明，\n收到，进展符合预期。两个关注点：\n1. 设计稿终审时间能否提前到周三？\n2. 预算使用率偏高，后续控制在 70% 以内。\nBest regards, Yang"',
			reply_patterns:
				"同意类：直接给结论 + 一句行动指引，不超过 3 行\n拒绝/待定类：先说结论，再说原因和下一步，语气保持平和\n催促类：不直接催，而是问进展 + 给 deadline 提醒",
			tone_preference: "专业但不生硬",
			work_habits:
				"上午 10 点前集中处理审批类邮件。下午查看汇报和进度更新。紧急事项随时处理，但倾向先看 AI 摘要再决定是否读原文。周五下午不处理非紧急事项。",
			signature: "Best regards, Yang",
		},
		changeLogs: [
			{
				title: "学习了写作风格（分析 12 封已发邮件）：",
				details: [
					"· 参照邮件: 提取了 3 封典型回复作为风格参照",
					"· 回复模式: 总结了同意/拒绝/催促三种回复模式",
				],
				time: "4月8日 14:32",
			},
			{
				title: "手动更新了 我的画像：",
				details: ["· 语气偏好: 专业 → 专业但不生硬，不要冗长客套话"],
				time: "4月7日 10:15",
			},
			{
				title: "创建了个人画像：",
				details: [
					"· 角色: 投资总监，关注硬科技和 AI 赛道",
					"· 工作习惯: 上午 10 点前集中处理审批类邮件…",
					"· 签名: Best regards, Yang",
				],
				time: "4月5日 09:22",
			},
		],
	},
	{
		objectType: "person",
		name: "张伟",
		objectId: "zhang.wei@acme.com",
		attributes: {
			role: "采购部经理",
			company: "ACME Corporation",
			communication_style:
				"极度务实，邮件从不寒暄。审批邮件通常在上午 10 点前处理。预算超过 5 万的采购会要求附 ROI 分析表。发来的邮件如果只有一行「收到」代表同意。",
			sample_interactions:
				'📨 张伟发来的典型邮件：\n"采购申请：服务器 3 台，¥42,000。附报价单。请审批。"\n→ 特点：无寒暄，直入主题，通常附件齐全\n\n📨 张伟的确认风格：\n"收到"\n→ 含义：等同于「同意，知道了」，无需追问\n\n📨 张伟不满时：\n"这个交付时间不可接受，请重新评估。"\n→ 出现「不可接受」措辞时需高度关注',
			sensitivity: "财务数据、供应商报价",
			relationship: "频繁合作方，Q1 合作了 3 个采购项目",
		},
		changeLogs: [
			{
				title: "学习了沟通模式（分析 8 封往来邮件）：",
				details: [
					"· 典型对话: 提取了 3 种典型沟通场景作为参照",
					"· 沟通风格: 直接偏好简洁 → 极度务实，「收到」代表同意",
				],
				time: "4月8日 11:05",
			},
			{
				title: "更新了 张伟：",
				details: [
					"· 关系: （空） → 频繁合作方，Q1 合作了 3 个采购项目",
				],
				time: "4月6日 15:30",
			},
			{
				title: "创建了 张伟：",
				details: [
					"· 职务: 采购部经理",
					"· 公司: ACME Corporation",
					"· 敏感点: 财务数据",
				],
				time: "4月3日 09:45",
			},
		],
	},
	{
		objectType: "person",
		name: "Sarah Chen",
		objectId: "sarah.chen@techflow.io",
		attributes: {
			role: "CTO",
			company: "TechFlow",
			communication_style:
				"中英混用，技术讨论偏英文，商务沟通用中文。重视数据支撑，不接受「大概」「差不多」这类模糊表述。回复速度快但篇幅短，习惯用 bullet points。",
			sample_interactions:
				'📨 Sarah 的技术讨论邮件：\n"Yang, quick update on the API migration:\n- Phase 1: Done (latency down 40%)\n- Phase 2: ETA next Friday\n- Blocker: Need your team\'s auth token rotation schedule"\n→ 特点：英文 bullet points，数据驱动\n\n📨 Sarah 的拒绝方式：\n"这个方案的数据支撑不够，能不能补充 benchmark 对比？"\n→ 从不直接说「不行」，而是要求补充数据',
			preferences: "偏好异步沟通，不喜欢突然的电话会议",
		},
		changeLogs: [
			{
				title: "学习了沟通模式（分析 5 封往来邮件）：",
				details: [
					"· 典型对话: 提取了技术讨论和拒绝场景作为参照",
					"· 偏好: 偏好异步沟通，不喜欢突然的电话会议",
				],
				time: "4月7日 16:20",
			},
			{
				title: "创建了 Sarah Chen：",
				details: [
					"· 职务: CTO",
					"· 公司: TechFlow",
					"· 沟通风格: 中英混用，技术讨论偏英文…",
				],
				time: "4月5日 11:10",
			},
		],
	},
	{
		objectType: "project",
		name: "Q3 品牌升级项目",
		attributes: {
			status: "进行中 — 设计评审阶段",
			deadline: "2026-09-30",
			owner: "李明（市场部）",
			participants: "李明、张伟、设计团队、外部供应商A",
			progress:
				"设计团队已完成第二版初稿，市场部李明下周一提交反馈。预算已使用 60%，剩余 ¥120,000。8 月中旬的全员评审会需要准备完整品牌手册、竞品分析报告和预算执行明细。供应商 A 已确认可以按时交付素材。",
			budget: "总预算 ¥300,000，已使用 ¥180,000",
		},
		changeLogs: [
			{
				title: "更新了 Q3品牌升级项目：",
				details: [
					"· 进展: 初步方案评审中 → 设计已到第二版，待最终确认",
				],
				time: "4月8日 09:30",
			},
			{
				title: "更新了 Q3品牌升级项目：",
				details: ["· 参与者: 待定 → 供应商 A（星辉设计）"],
				time: "4月6日 14:20",
			},
			{
				title: "创建了 Q3品牌升级项目：",
				details: [
					"· 截止日期: 2026-06-30",
					"· 负责人: 王明",
					"· 预算: ¥200,000",
				],
				time: "4月1日 10:05",
			},
		],
	},
	{
		objectType: "event",
		name: "供应商 B 第 3 次交付延迟",
		attributes: {
			happened_at: "2026-04-05",
			participants: "张伟、供应商 B 项目经理刘涛",
			impact: "Q3 品牌升级项目时间线推迟两周。张伟对此非常不满，邮件中使用了「不可接受」措辞。触发了合同续签的重新评估。",
			follow_up:
				"已决定拒绝供应商 B 续签，优先评估供应商 A。张伟已收到确认，正在与法务沟通合同条款。",
			related_project: "Q3 品牌升级项目",
		},
		changeLogs: [
			{
				title: "更新了 供应商 B 交期延误事件：",
				details: [
					"· 后续动作: 等待张伟回复 → 张伟已确认损失数据，法务沟通中",
				],
				time: "4月7日 11:30",
			},
			{
				title: "创建了 供应商 B 交期延误事件：",
				details: [
					"· 影响: 影响 Q3 品牌升级项目交付时间",
					"· 相关人: zhang.wei@acme.com",
				],
				time: "4月5日 14:45",
			},
		],
	},
	{
		objectType: "preference",
		name: "审批邮件处理规则",
		attributes: {
			rule: "金额低于 ¥10,000 的常规采购审批，直接建议通过并生成回复草稿。金额 ¥10,000-50,000 需要汇总关键信息后等待确认。超过 ¥50,000 必须标记为高优先级并附上历史采购对比。",
			context: "审批类邮件的自动化处理策略",
			scope: "所有采购审批邮件",
			examples:
				'📋 场景 1 — 低金额自动通过：\n收到：「办公用品采购 ¥8,000，附报价单」\n→ AI 草拟回复："Hi 张伟，采购申请已审批通过，请按流程推进。"\n\n📋 场景 2 — 中等金额等待确认：\n收到：「服务器采购 ¥35,000，3 台 Dell R740」\n→ AI 摘要：金额 ¥35k / 供应商 Dell / 历史均价 ¥11k/台 ✓\n→ 等待用户确认后发送\n\n📋 场景 3 — 高金额重点关注：\n收到：「外包合同续签 ¥120,000」\n→ AI 标记高优 + 拉取历史：去年同期 ¥95,000（↑26%）\n→ 提示：建议比价或议价',
		},
		changeLogs: [
			{
				title: "手动更新了 审批邮件处理规则：",
				details: ["· 规则: ≤ ¥5,000 自动批准 → ≤ ¥10,000 自动批准"],
				time: "4月7日 10:40",
			},
			{
				title: "创建了 审批邮件处理规则：",
				details: [
					"· 规则: ≤ ¥5,000 自动批准",
					"· 适用场景: 审批类邮件的自动化处理",
					"· 示例: ¥8,000 办公用品 → 草拟「同意」回复",
				],
				time: "4月4日 11:20",
			},
		],
	},
	{
		objectType: "decision",
		name: "供应商 B 合同续签拒绝",
		attributes: {
			decision: "拒绝供应商 B 的 2026-2027 年度合同续签",
			reason: "过去半年交付延迟累计 3 次。最近一次（4月5日）直接导致 Q3 品牌升级项目推迟两周，引发内部团队不满。与采购部张伟沟通后达成一致：供应商 B 的可靠性不满足要求。",
			outcome:
				'合同 6 月底到期后不续签。替代方案：供应商 A（报价高 8% 但从未延迟）。\n\n📧 已发送的通知邮件：\n"Dear Mr. Liu,\nAfter careful evaluation, we have decided not to renew the 2026-2027 contract due to repeated delivery delays. We appreciate our past cooperation.\nBest regards, Yang"',
			decided_at: "2026-04-06",
			related_entities: "Q3 品牌升级项目、供应商B第3次交付延迟",
		},
		changeLogs: [
			{
				title: "更新了 拒绝供应商 B 续约：",
				details: [
					"· 结果: 已邮件通知供应商 → 已邮件通知，法务审核退出条款中",
				],
				time: "4月8日 10:15",
			},
			{
				title: "更新了 拒绝供应商 B 续约：",
				details: [
					"· 结果: （空） → 已邮件通知供应商 B（用户确认决策）",
				],
				time: "4月6日 16:00",
			},
			{
				title: "创建了 拒绝供应商 B 续约：",
				details: [
					"· 原因: 连续 2 次交期延误，且未提供改进方案",
					"· 背景: 已联系供应商 C 和 D 报价",
					"· 决策: 拒绝续签 2026-2027 年度合同",
				],
				time: "4月6日 11:30",
			},
		],
	},
];

function MemoryEmptyState() {
	return (
		<div className="space-y-6">
			{/* How it works — flow diagram */}
			<div className="rounded-xl border bg-linear-to-b from-muted/30 to-transparent p-4">
				<div className="flex items-center gap-2 mb-3">
					<div className="size-6 rounded-lg bg-violet-500/10 flex items-center justify-center">
						<BrainIcon className="size-3.5 text-violet-500" />
					</div>
					<div>
						<h3 className="text-sm font-semibold leading-tight">
							记忆系统如何工作
						</h3>
						<p className="text-[11px] text-muted-foreground">
							AI 越用越懂你——每次交互都建立在上一次的基础上
						</p>
					</div>
				</div>

				{/* Flow steps — desktop: 4 steps with arrows; mobile: 2x2 grid */}
				<div className="hidden sm:grid sm:grid-cols-7 items-start">
					<FlowStep icon={InboxIcon} color="text-blue-500" bgColor="bg-blue-500/10" title="邮件进入" desc="AI 自动解析内容、联系人、意图" />
					<FlowArrow />
					<FlowStep icon={SparklesIcon} color="text-violet-500" bgColor="bg-violet-500/10" title="AI 理解" desc="识别联系人身份、项目关联、处理习惯" />
					<FlowArrow />
					<FlowStep icon={BrainIcon} color="text-emerald-500" bgColor="bg-emerald-500/10" title="写入记忆" desc="新信息更新到对应的记忆对象卡片" />
					<FlowArrow />
					<FlowStep icon={ZapIcon} color="text-amber-500" bgColor="bg-amber-500/10" title="智能应用" desc="下次遇到同一联系人或项目时自动应用" />
				</div>
				<div className="grid grid-cols-2 gap-3 sm:hidden">
					<FlowStep icon={InboxIcon} color="text-blue-500" bgColor="bg-blue-500/10" title="邮件进入" desc="解析内容、联系人、意图" />
					<FlowStep icon={SparklesIcon} color="text-violet-500" bgColor="bg-violet-500/10" title="AI 理解" desc="识别身份、关联、习惯" />
					<FlowStep icon={BrainIcon} color="text-emerald-500" bgColor="bg-emerald-500/10" title="写入记忆" desc="更新记忆对象卡片" />
					<FlowStep icon={ZapIcon} color="text-amber-500" bgColor="bg-amber-500/10" title="智能应用" desc="自动应用已有认知" />
				</div>
			</div>

			{/* How to trigger memories */}
			<div>
				<p className="text-xs font-semibold mb-2.5 flex items-center gap-1.5">
					<RefreshCwIcon className="size-3.5 text-muted-foreground" />
					记忆的产生方式
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
					{TRIGGER_EXAMPLES.map((ex) => {
						const TriggerIcon = ex.icon;
						return (
							<div
								key={ex.trigger}
								className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5"
							>
								<div
									className={cn(
										"size-6 rounded-md flex items-center justify-center shrink-0 mt-0.5",
										ex.bgColor,
									)}
								>
									<TriggerIcon
										className={cn("size-3.5", ex.color)}
									/>
								</div>
								<div className="min-w-0">
									<p className="text-xs font-medium">
										{ex.trigger}
									</p>
									<p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
										{ex.detail}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Demo object cards with changeLogs */}
			<div>
				<p className="text-xs font-semibold mb-2.5 flex items-center gap-1.5">
					<LightbulbIcon className="size-3.5 text-muted-foreground" />
					记忆对象预览 — AI 会自动构建类似这样的结构化认知
				</p>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
					{DEMO_OBJECTS.map((demo) => (
						<DemoObjectCard
							key={`demo-${demo.objectType}-${demo.name}`}
							demo={demo}
						/>
					))}
				</div>
				<p className="text-[11px] text-muted-foreground/60 text-center mt-3 italic">
					以上为功能演示 · 开始使用 Flowmail 后，AI
					会基于你的真实邮件自动构建记忆
				</p>
			</div>
		</div>
	);
}

// ─── Flow diagram components ───

function FlowStep({
	icon: Icon,
	color,
	bgColor,
	title,
	desc,
}: {
	icon: typeof BrainIcon;
	color: string;
	bgColor: string;
	title: string;
	desc: string;
}) {
	return (
		<div className="flex flex-col items-center text-center px-1.5">
			<div
				className={cn(
					"size-8 rounded-lg flex items-center justify-center mb-1.5",
					bgColor,
				)}
			>
				<Icon className={cn("size-4", color)} />
			</div>
			<p className="text-[11px] font-semibold leading-tight">{title}</p>
			<p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
				{desc}
			</p>
		</div>
	);
}

function FlowArrow() {
	return (
		<div className="hidden sm:flex items-center justify-center pt-3">
			<ArrowRightIcon className="size-3.5 text-muted-foreground/30" />
		</div>
	);
}

// ─── Demo card with changeLogs ───

function DemoObjectCard({ demo }: { demo: DemoObject }) {
	const [logsOpen, setLogsOpen] = useState(false);

	const cfg = TYPE_CONFIG[demo.objectType];
	if (!cfg) {
		return null;
	}
	const DemoIcon = cfg.icon;
	const fieldLabels = cfg.fieldLabels;
	const shortFields: [string, string][] = [];
	const longFields: [string, string][] = [];

	for (const [k, v] of Object.entries(demo.attributes)) {
		const s = String(v);
		if (s.length >= LONG_VALUE_THRESHOLD || s.includes("\n")) {
			longFields.push([k, s]);
		} else {
			shortFields.push([k, s]);
		}
	}

	return (
		<div className="rounded-2xl border border-dashed hover:border-border/60 transition-colors flex flex-col overflow-hidden">
			{/* Header */}
			<div className="px-4 pt-4 pb-3">
				<div className="flex items-center gap-2.5">
					<div className={cn("size-8 rounded-xl flex items-center justify-center shrink-0", cfg.bgColor)}>
						<DemoIcon className={cn("size-4", cfg.color)} />
					</div>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<h3 className="text-sm font-semibold truncate">{demo.name}</h3>
							<span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", cfg.bgColor, cfg.color)}>
								{cfg.label}
							</span>
						</div>
						{demo.objectId && (
							<p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">{demo.objectId}</p>
						)}
					</div>
				</div>
			</div>

			{/* Fields */}
			<div className="px-4 pb-3 space-y-2">
				{shortFields.map(([k, v]) => (
					<div key={k} className="flex items-baseline gap-2">
						<span className="text-[11px] text-muted-foreground/60 shrink-0 min-w-16">
							{fieldLabels[k] ?? k}
						</span>
						<span className="text-[13px] text-foreground/70 wrap-break-word">{v}</span>
					</div>
				))}
				{longFields.map(([k, v]) => (
					<div key={k}>
						<span className="text-[11px] text-muted-foreground/60 font-medium block mb-1">
							{fieldLabels[k] ?? k}
						</span>
						<div className="rounded-lg bg-muted/30 px-3 py-2">
							<p className="text-[12px] text-foreground/60 line-clamp-3 leading-relaxed whitespace-pre-wrap">{v}</p>
						</div>
					</div>
				))}
			</div>

			{/* Footer */}
			{demo.changeLogs.length > 0 && (
				<>
					<div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 mt-auto">
						<span className="text-[11px] text-muted-foreground/50 flex items-center gap-1.5">
							<ClockIcon className="size-3" />
							{demo.changeLogs[0].time}
						</span>
						<button
							type="button"
							onClick={() => setLogsOpen(!logsOpen)}
							className={cn(
								"inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition-colors",
								logsOpen
									? "bg-violet-500/10 text-violet-600"
									: "text-muted-foreground/50 hover:bg-muted hover:text-foreground",
							)}
						>
							{demo.changeLogs.length} 条变更
							{logsOpen ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
						</button>
					</div>

					{logsOpen && (
						<div className="px-4 py-3 border-t bg-muted/20">
							<div className="relative space-y-3 pl-4 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-border/50">
								{demo.changeLogs.map((log) => (
									<div key={log.title + log.time} className="relative">
										<div className="absolute left-[-13px] top-1.5 size-2 rounded-full bg-violet-400/60 ring-2 ring-background" />
										<p className="text-[12px] font-medium text-foreground/60">{log.title}</p>
										{log.details && log.details.length > 0 && (
											<div className="mt-1 space-y-0.5">
												{log.details.map((line) => (
													<p key={line} className="text-[11px] text-muted-foreground leading-relaxed font-mono">{line}</p>
												))}
											</div>
										)}
										<p className="text-[10px] text-muted-foreground/40 mt-1">{log.time}</p>
									</div>
								))}
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}

// ─── Trigger config ───

const TRIGGER_EXAMPLES = [
	{
		icon: MessageSquareIcon,
		color: "text-violet-500",
		bgColor: "bg-violet-500/10",
		trigger: "在 Agent 对话中交流",
		detail: "对话中提及联系人、项目、偏好时，AI 自动识别并写入记忆。例如你说「以后遇到张伟的邮件帮我自动标记为高优先」，AI 会记住这条规则。",
	},
	{
		icon: MailIcon,
		color: "text-blue-500",
		bgColor: "bg-blue-500/10",
		trigger: "处理邮件时",
		detail: "AI 分析邮件内容时自动提取：联系人的职务和沟通风格、项目的进展和截止日期、关键事件的影响和后续动作。",
	},
	{
		icon: SparklesIcon,
		color: "text-emerald-500",
		bgColor: "bg-emerald-500/10",
		trigger: "对 Agent 说「学习我的写作风格」",
		detail: "AI 分析你已发送的邮件，总结出回复习惯、语气偏好和常用结尾。之后草拟回复时会自动匹配你的风格。",
	},
	{
		icon: LightbulbIcon,
		color: "text-amber-500",
		bgColor: "bg-amber-500/10",
		trigger: "纠正或确认 AI 的判断",
		detail: "当你说「不对」或「就这样」时，AI 记住你的纠正并更新对应记忆。纠正的权重比自动识别更高，确保 AI 不重复犯错。",
	},
];
