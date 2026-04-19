"use client";

import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Spinner, cn } from "@repo/ui";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	ArrowDownIcon,
	ArrowUpIcon,
	BellIcon,
	BookOpenIcon,
	BriefcaseIcon,
	BuildingIcon,
	DollarSignIcon,
	FileSignatureIcon,
	FileTextIcon,
	GripVerticalIcon,
	HandshakeIcon,
	InboxIcon,
	MailIcon,
	MessageSquareIcon,
	PackageIcon,
	PenIcon,
	PlusIcon,
	SettingsIcon,
	ShieldCheckIcon,
	SparklesIcon,
	TagIcon,
	TrashIcon,
	TrendingUpIcon,
	UsersIcon,
	type LucideIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { usePageGuide } from "../hooks/use-page-guide";
import { useAgent } from "./AgentProvider";

const AVAILABLE_ICONS: { name: string; icon: LucideIcon }[] = [
	{ name: "BuildingIcon", icon: BuildingIcon },
	{ name: "TrendingUpIcon", icon: TrendingUpIcon },
	{ name: "FileSignatureIcon", icon: FileSignatureIcon },
	{ name: "MessageSquareIcon", icon: MessageSquareIcon },
	{ name: "BellIcon", icon: BellIcon },
	{ name: "BriefcaseIcon", icon: BriefcaseIcon },
	{ name: "DollarSignIcon", icon: DollarSignIcon },
	{ name: "HandshakeIcon", icon: HandshakeIcon },
	{ name: "UsersIcon", icon: UsersIcon },
	{ name: "AlertTriangleIcon", icon: AlertTriangleIcon },
	{ name: "BookOpenIcon", icon: BookOpenIcon },
	{ name: "PackageIcon", icon: PackageIcon },
	{ name: "ShieldCheckIcon", icon: ShieldCheckIcon },
	{ name: "FileTextIcon", icon: FileTextIcon },
	{ name: "InboxIcon", icon: InboxIcon },
	{ name: "MailIcon", icon: MailIcon },
	{ name: "TagIcon", icon: TagIcon },
	{ name: "SettingsIcon", icon: SettingsIcon },
];

interface SampleCategory {
	name: string;
	slug: string;
	icon: string;
	color: string;
	aiPrompt: string;
	description: string;
}

const SAMPLE_CATEGORIES: SampleCategory[] = [
	{
		name: "子公司月报",
		slug: "subsidiary-report",
		icon: "BuildingIcon",
		color: "#10b981",
		description: "各子公司发来的月度/季度经营汇报、KPI 数据、项目进展",
		aiPrompt:
			"Monthly/quarterly business reports from subsidiaries or portfolio companies. Includes KPI data, financial summaries, project progress, headcount changes. Usually has attachments (PDF/Excel) with detailed numbers.",
	},
	{
		name: "投资项目跟进",
		slug: "investment-followup",
		icon: "TrendingUpIcon",
		color: "#6366f1",
		description: "已投/在投项目的进展、估值、轮次更新、退出讨论",
		aiPrompt:
			"Updates from portfolio companies or investment targets: round updates, valuation changes, milestone hits, exit discussions, follow-on rounds, board updates.",
	},
	{
		name: "合同/审批",
		slug: "contract-approval",
		icon: "FileSignatureIcon",
		color: "#f59e0b",
		description: "需要签字、批准、走流程的合同、协议、采购单",
		aiPrompt:
			"Anything requesting your signature, approval, or sign-off: contracts, agreements, purchase orders, expense approvals, NDA, term sheets pending review.",
	},
	{
		name: "客户对接",
		slug: "client-comms",
		icon: "MessageSquareIcon",
		color: "#0ea5e9",
		description: "客户/LP/合作方主动发来的咨询、需求、反馈",
		aiPrompt:
			"Inbound communications from clients, LPs, partners, or external stakeholders: questions, requests, feedback, meeting requests, intros.",
	},
	{
		name: "内部通知",
		slug: "internal-notice",
		icon: "BellIcon",
		color: "#94a3b8",
		description: "团队内部公告、HR、IT、行政通知（多为 FYI）",
		aiPrompt:
			"Internal team announcements, HR/IT/admin notifications, all-hands invites, policy updates. Usually FYI-only, no action required.",
	},
];

const AVAILABLE_COLORS = [
	"#f59e0b",
	"#3b82f6",
	"#ef4444",
	"#10b981",
	"#8b5cf6",
	"#ec4899",
	"#f97316",
	"#06b6d4",
	"#6366f1",
	"#84cc16",
	"#14b8a6",
	"#a855f7",
];

function resolveIcon(iconName: string): LucideIcon {
	return (
		AVAILABLE_ICONS.find((i) => i.name === iconName)?.icon ?? TagIcon
	);
}

const SUGGEST_PROMPT_TEMPLATE =
	"我还没建任何分类（或者现有分类不合适）。请用 suggest_categories_from_inbox 看一下我最近的邮件，建议 3-6 个合适的分类。给我看建议清单，我确认后用 create_categories 批量写入。";

interface CategoryFormData {
	name: string;
	slug: string;
	icon: string;
	color: string;
	aiPrompt: string;
}

export function CategoryManager() {
	const { activeOrganization } = useActiveOrganization();
	const queryClient = useQueryClient();
	const { triggerAgentPrompt } = useAgent();

	usePageGuide("configureCategories", [
		{
			element: '[data-guide="create-category-btn"]',
			title: "第 1 步：点击「新建分类」",
			description:
				"点击此按钮创建一个分类。每个分类代表一种业务类型（如审批、汇报、工单等）。\n\n创建时你需要填写：\n• 分类名称（如「审批请求」）\n• AI 提示词（告诉 AI 什么样的邮件属于这个分类，比如「包含请审批、approval 等关键词的邮件」）\n\nAI 会根据你写的提示词自动将新邮件归类。",
			side: "bottom",
		},
	]);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingCategory, setEditingCategory] = useState<string | null>(
		null,
	);

	const orgId = activeOrganization?.id ?? "";

	const { data: categories, isLoading } = useQuery({
		...orpc.categories.list.queryOptions({
			input: { organizationId: orgId },
		}),
		enabled: !!orgId,
	});

	const invalidate = useCallback(() => {
		queryClient.invalidateQueries({
			queryKey: orpc.categories.list.key(),
		});
	}, [queryClient]);

	const createMutation = useMutation(
		orpc.categories.create.mutationOptions({ onSuccess: invalidate }),
	);

	const updateMutation = useMutation(
		orpc.categories.update.mutationOptions({ onSuccess: invalidate }),
	);

	const deleteMutation = useMutation(
		orpc.categories.delete.mutationOptions({ onSuccess: invalidate }),
	);

	const reorderMutation = useMutation(
		orpc.categories.reorder.mutationOptions({ onSuccess: invalidate }),
	);

	const bulkCreateMutation = useMutation(
		orpc.categories.bulkCreate.mutationOptions({ onSuccess: invalidate }),
	);

	function handleAddSample(sample: SampleCategory) {
		createMutation.mutate({
			organizationId: orgId,
			name: sample.name,
			slug: sample.slug,
			icon: sample.icon,
			color: sample.color,
			aiPrompt: sample.aiPrompt,
		});
	}

	function handleAddAllSamples() {
		const existingSlugs = new Set((categories ?? []).map((c) => c.slug));
		const toAdd = SAMPLE_CATEGORIES.filter((s) => !existingSlugs.has(s.slug));
		if (toAdd.length === 0) {
			return;
		}
		bulkCreateMutation.mutate({
			organizationId: orgId,
			categories: toAdd.map((s) => ({
				name: s.name,
				slug: s.slug,
				icon: s.icon,
				color: s.color,
				aiPrompt: s.aiPrompt,
			})),
		});
	}

	function handleAskAgentSuggest() {
		triggerAgentPrompt({ text: SUGGEST_PROMPT_TEMPLATE });
	}

	function handleMoveUp(index: number) {
		if (!categories || index <= 0) {
			return;
		}
		const ordered = [...categories];
		[ordered[index - 1], ordered[index]] = [
			ordered[index],
			ordered[index - 1],
		];
		reorderMutation.mutate({
			organizationId: orgId,
			orderedIds: ordered.map((c) => c.id),
		});
	}

	function handleMoveDown(index: number) {
		if (!categories || index >= categories.length - 1) {
			return;
		}
		const ordered = [...categories];
		[ordered[index], ordered[index + 1]] = [
			ordered[index + 1],
			ordered[index],
		];
		reorderMutation.mutate({
			organizationId: orgId,
			orderedIds: ordered.map((c) => c.id),
		});
	}

	function handleDelete(id: string) {
		if (!confirm("确定删除此分类？关联的邮件将移入「未分类」。")) {
			return;
		}
		deleteMutation.mutate({ id, organizationId: orgId });
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Spinner className="size-5 text-primary" />
			</div>
		);
	}

	const hasNoCategories = (categories?.length ?? 0) === 0;
	const allDefault =
		(categories?.length ?? 0) > 0 && (categories ?? []).every((c) => c.isDefault);
	const existingSlugs = new Set((categories ?? []).map((c) => c.slug));
	const remainingSamples = SAMPLE_CATEGORIES.filter(
		(s) => !existingSlugs.has(s.slug),
	);

	return (
		<div data-module="categories" className="space-y-6">
			{hasNoCategories ? (
				<EmptyCategoriesState
					onAskAgent={handleAskAgentSuggest}
					onAddSample={handleAddSample}
					onAddAll={handleAddAllSamples}
					samples={SAMPLE_CATEGORIES}
					isPending={createMutation.isPending || bulkCreateMutation.isPending}
				/>
			) : null}

			{allDefault ? (
				<div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-900/10 p-4 flex items-start gap-3">
					<AlertTriangleIcon className="size-5 text-amber-600 shrink-0 mt-0.5" />
					<div className="flex-1 min-w-0 space-y-2">
						<p className="text-sm font-medium text-amber-900 dark:text-amber-200">
							当前是 Flowmail 早期版本的默认分类
						</p>
						<p className="text-xs text-amber-800/80 dark:text-amber-200/70">
							Flowmail 不再预设通用分类。建议你根据自己的工作习惯重新定义——比如「子公司月报」「投资项目跟进」「合同审批」这类反映你做决策方式的分类。已有邮件不会受影响。
						</p>
						<div className="flex flex-wrap gap-2 pt-1">
							<Button
								size="sm"
								onClick={handleAskAgentSuggest}
								disabled={createMutation.isPending}
							>
								<SparklesIcon className="size-3.5 mr-1.5" />
								让 AI 看一遍我的邮件给我建议
							</Button>
						</div>
					</div>
				</div>
			) : null}

			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					共 {categories?.length ?? 0} 个分类
					{allDefault ? "（全部为旧默认分类）" : ""}
				</p>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleAskAgentSuggest}
						disabled={createMutation.isPending}
					>
						<SparklesIcon className="size-3.5 mr-1.5" />
						让 AI 建议
					</Button>
					<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
						<DialogTrigger asChild>
							<Button
								data-guide="create-category-btn"
								onClick={() => {
									setEditingCategory(null);
									setDialogOpen(true);
								}}
							>
								<PlusIcon className="size-4 mr-1.5" />
								新建分类
							</Button>
						</DialogTrigger>
					<DialogContent className="sm:max-w-[520px]">
						<CategoryForm
							editId={editingCategory}
							categories={categories ?? []}
							onCreate={(data) => {
								createMutation.mutate(
									{ ...data, organizationId: orgId },
									{
										onSuccess: () =>
											setDialogOpen(false),
									},
								);
							}}
							onUpdate={(id, data) => {
								updateMutation.mutate(
									{ id, ...data },
									{
										onSuccess: () =>
											setDialogOpen(false),
									},
								);
							}}
							isPending={
								createMutation.isPending ||
								updateMutation.isPending
							}
						/>
					</DialogContent>
				</Dialog>
				</div>
			</div>

			{!hasNoCategories && remainingSamples.length > 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-3">
					<div className="flex items-center justify-between flex-wrap gap-2">
						<div>
							<p className="text-sm font-medium">还有这些常见分类可以一键添加</p>
							<p className="text-xs text-muted-foreground mt-0.5">
								Flowmail 给你准备的几个示例。觉得合适就加，不合适跳过。
							</p>
						</div>
						<Button
							size="sm"
							variant="outline"
							onClick={handleAddAllSamples}
							disabled={bulkCreateMutation.isPending}
						>
							{bulkCreateMutation.isPending && <Spinner className="size-3.5 mr-1.5" />}
							全部添加 ({remainingSamples.length})
						</Button>
					</div>
					<div className="flex flex-wrap gap-2">
						{remainingSamples.map((s) => {
							const Icon = resolveIcon(s.icon);
							return (
								<button
									type="button"
									key={s.slug}
									onClick={() => handleAddSample(s)}
									disabled={createMutation.isPending}
									className="group flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs transition-colors hover:bg-primary/10 hover:border-primary/50 disabled:opacity-50"
									title={s.description}
								>
									<Icon className="size-3.5" style={{ color: s.color }} />
									<span className="font-medium">{s.name}</span>
									<PlusIcon className="size-3 text-muted-foreground group-hover:text-primary" />
								</button>
							);
						})}
					</div>
				</div>
			) : null}

			<div className="space-y-2">
				{categories?.map((cat, index) => {
					const Icon = resolveIcon(cat.icon);
					return (
						<div
							key={cat.id}
							className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
						>
							<GripVerticalIcon className="size-4 text-muted-foreground/40 shrink-0" />

							<div
								className="flex size-9 items-center justify-center rounded-lg shrink-0"
								style={{ backgroundColor: `${cat.color}15` }}
							>
								<Icon
									className="size-4"
									style={{ color: cat.color }}
								/>
							</div>

							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium text-foreground">
										{cat.name}
									</span>
									<span className="text-xs text-muted-foreground font-mono">
										{cat.slug}
									</span>
									{cat.isDefault && (
										<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
											默认
										</span>
									)}
								</div>
								<p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[400px]">
									{cat.aiPrompt || "未配置 AI 提示词"}
								</p>
							</div>

							<span className="text-xs tabular-nums text-muted-foreground shrink-0">
								{cat._count.entities} 条
							</span>

							<div className="flex items-center gap-1 shrink-0">
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									disabled={index === 0}
									onClick={() => handleMoveUp(index)}
								>
									<ArrowUpIcon className="size-3.5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									disabled={
										index ===
										(categories?.length ?? 1) - 1
									}
									onClick={() => handleMoveDown(index)}
								>
									<ArrowDownIcon className="size-3.5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									onClick={() => {
										setEditingCategory(cat.id);
										setDialogOpen(true);
									}}
								>
									<PenIcon className="size-3.5" />
								</Button>
								{!cat.isDefault && (
									<Button
										variant="ghost"
										size="icon"
										className="size-7 text-destructive hover:text-destructive"
										onClick={() =>
											handleDelete(cat.id)
										}
										disabled={deleteMutation.isPending}
									>
										<TrashIcon className="size-3.5" />
									</Button>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function CategoryForm({
	editId,
	categories,
	onCreate,
	onUpdate,
	isPending,
}: {
	editId: string | null;
	categories: {
		id: string;
		name: string;
		slug: string;
		icon: string;
		color: string;
		aiPrompt: string;
		isDefault: boolean;
	}[];
	onCreate: (data: CategoryFormData) => void;
	onUpdate: (id: string, data: Partial<CategoryFormData>) => void;
	isPending: boolean;
}) {
	const existing = editId
		? categories.find((c) => c.id === editId)
		: null;

	const [name, setName] = useState(existing?.name ?? "");
	const [slug, setSlug] = useState(existing?.slug ?? "");
	const [icon, setIcon] = useState(existing?.icon ?? "TagIcon");
	const [color, setColor] = useState(existing?.color ?? "#6366f1");
	const [aiPrompt, setAiPrompt] = useState(existing?.aiPrompt ?? "");
	const [autoSlug, setAutoSlug] = useState(!editId);

	function handleNameChange(value: string) {
		setName(value);
		if (autoSlug && !editId) {
			setSlug(
				value
					.toLowerCase()
					.replace(/[^a-z0-9\u4e00-\u9fa5-\s]/g, "")
					.replace(/[\s\u4e00-\u9fa5]+/g, "-")
					.replace(/-+/g, "-")
					.replace(/^-|-$/g, ""),
			);
		}
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (editId) {
			onUpdate(editId, {
				name: existing?.isDefault ? undefined : name,
				icon,
				color,
				aiPrompt,
			});
		} else {
			onCreate({ name, slug, icon, color, aiPrompt });
		}
	}

	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{editId ? "编辑分类" : "新建分类"}
				</DialogTitle>
			</DialogHeader>
			<form onSubmit={handleSubmit} className="space-y-5 mt-2">
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-1.5">
						<Label>名称</Label>
						<Input
							value={name}
							onChange={(e) =>
								handleNameChange(e.target.value)
							}
							placeholder="例如：客服工单"
							required
							disabled={!!existing?.isDefault}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Slug</Label>
						<Input
							value={slug}
							onChange={(e) => {
								setSlug(e.target.value);
								setAutoSlug(false);
							}}
							placeholder="例如：customer-service"
							required
							disabled={!!editId}
							pattern="[a-z0-9-]+"
						/>
					</div>
				</div>

				<div className="space-y-1.5">
					<Label>图标</Label>
					<div className="flex flex-wrap gap-1.5">
						{AVAILABLE_ICONS.map((item) => (
							<button
								key={item.name}
								type="button"
								onClick={() => setIcon(item.name)}
								className={cn(
									"flex size-9 items-center justify-center rounded-lg border transition-all",
									icon === item.name
										? "border-primary bg-primary/10 ring-1 ring-primary/30"
										: "border-border hover:bg-muted",
								)}
							>
								<item.icon
									className="size-4"
									style={{
										color:
											icon === item.name
												? color
												: undefined,
									}}
								/>
							</button>
						))}
					</div>
				</div>

				<div className="space-y-1.5">
					<Label>颜色</Label>
					<div className="flex flex-wrap gap-1.5">
						{AVAILABLE_COLORS.map((c) => (
							<button
								key={c}
								type="button"
								onClick={() => setColor(c)}
								className={cn(
									"size-7 rounded-full border-2 transition-all",
									color === c
										? "border-foreground scale-110"
										: "border-transparent hover:scale-105",
								)}
								style={{ backgroundColor: c }}
							/>
						))}
					</div>
				</div>

				<div className="space-y-1.5">
					<Label>AI 分类提示词</Label>
					<textarea
						value={aiPrompt}
						onChange={(e) => setAiPrompt(e.target.value)}
						placeholder="描述符合该分类的邮件特征，例如：包含审批请求、授权需求的邮件..."
						rows={3}
						className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-none"
					/>
					<p className="text-[11px] text-muted-foreground">
						AI 将使用此提示词来判断邮件是否属于该分类。请描述该分类邮件的关键特征和关键词。
					</p>
				</div>

				<div className="flex items-center gap-3 pt-2">
					<div
						className="flex size-10 items-center justify-center rounded-lg"
						style={{ backgroundColor: `${color}15` }}
					>
						{(() => {
							const PreviewIcon = resolveIcon(icon);
							return (
								<PreviewIcon
									className="size-5"
									style={{ color }}
								/>
							);
						})()}
					</div>
					<div>
						<p className="text-sm font-medium">{name || "预览"}</p>
						<p className="text-xs text-muted-foreground font-mono">
							{slug || "slug"}
						</p>
					</div>
					<Button
						type="submit"
						className="ml-auto"
						disabled={isPending || !name || !slug}
					>
						{isPending && (
							<Spinner className="size-3.5 mr-1.5" />
						)}
						{editId ? "保存" : "创建"}
					</Button>
				</div>
			</form>
		</>
	);
}

function EmptyCategoriesState({
	onAskAgent,
	onAddSample,
	onAddAll,
	samples,
	isPending,
}: {
	onAskAgent: () => void;
	onAddSample: (s: SampleCategory) => void;
	onAddAll: () => void;
	samples: SampleCategory[];
	isPending: boolean;
}) {
	return (
		<div className="rounded-xl border-2 border-dashed border-primary/30 bg-linear-to-br from-primary/5 via-transparent to-transparent p-6 sm:p-8 space-y-6">
			<div className="space-y-2 max-w-2xl">
				<div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-medium">
					<SparklesIcon className="size-3" />
					Flowmail 不预设分类
				</div>
				<h2 className="text-lg sm:text-xl font-semibold tracking-tight">
					你怎么处理邮件，我们就按你的方式来
				</h2>
				<p className="text-sm text-muted-foreground">
					每个人的工作场景不一样。先建几个属于你的分类，AI 才能按照你的方式去归类、汇总和提醒。
				</p>
			</div>

			<div className="grid sm:grid-cols-2 gap-3">
				<button
					type="button"
					onClick={onAskAgent}
					disabled={isPending}
					className="group relative overflow-hidden rounded-lg border-2 border-primary bg-primary text-primary-foreground p-4 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
				>
					<div className="flex items-start gap-3">
						<div className="rounded-lg bg-primary-foreground/15 p-2 shrink-0">
							<SparklesIcon className="size-5" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="font-semibold text-sm">让 AI 看一遍我的邮件</div>
							<div className="text-xs text-primary-foreground/80 mt-0.5">
								扫描最近 50 封 → 给出 3-6 个针对你的分类建议
							</div>
						</div>
					</div>
				</button>

				<button
					type="button"
					onClick={onAddAll}
					disabled={isPending}
					className="group relative overflow-hidden rounded-lg border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60"
				>
					<div className="flex items-start gap-3">
						<div className="rounded-lg bg-muted p-2 shrink-0">
							<PackageIcon className="size-5 text-foreground" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="font-semibold text-sm">用我们准备的示例</div>
							<div className="text-xs text-muted-foreground mt-0.5">
								一键添加 {samples.length} 个常见分类（投资人/管理者场景）
							</div>
						</div>
					</div>
				</button>
			</div>

			<div className="space-y-3">
				<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
					或者按需挑选
				</p>
				<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
					{samples.map((s) => {
						const Icon = resolveIcon(s.icon);
						return (
							<button
								type="button"
								key={s.slug}
								onClick={() => onAddSample(s)}
								disabled={isPending}
								className="group flex items-start gap-2.5 rounded-lg border bg-card p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
							>
								<div
									className="flex size-8 items-center justify-center rounded-md shrink-0"
									style={{ backgroundColor: `${s.color}15` }}
								>
									<Icon className="size-4" style={{ color: s.color }} />
								</div>
								<div className="flex-1 min-w-0 space-y-0.5">
									<div className="flex items-center gap-1.5">
										<span className="text-sm font-medium truncate">{s.name}</span>
										<PlusIcon className="size-3 text-muted-foreground/50 group-hover:text-primary shrink-0" />
									</div>
									<p className="text-[11px] text-muted-foreground line-clamp-2">
										{s.description}
									</p>
								</div>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
