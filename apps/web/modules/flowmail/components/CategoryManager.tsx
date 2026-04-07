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
	FileTextIcon,
	GripVerticalIcon,
	InboxIcon,
	MailIcon,
	MessageSquareIcon,
	PenIcon,
	PlusIcon,
	SettingsIcon,
	ShieldCheckIcon,
	TagIcon,
	TrashIcon,
	type LucideIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { usePageGuide } from "../hooks/use-page-guide";

const AVAILABLE_ICONS: { name: string; icon: LucideIcon }[] = [
	{ name: "ShieldCheckIcon", icon: ShieldCheckIcon },
	{ name: "FileTextIcon", icon: FileTextIcon },
	{ name: "AlertTriangleIcon", icon: AlertTriangleIcon },
	{ name: "MessageSquareIcon", icon: MessageSquareIcon },
	{ name: "InboxIcon", icon: InboxIcon },
	{ name: "MailIcon", icon: MailIcon },
	{ name: "TagIcon", icon: TagIcon },
	{ name: "SettingsIcon", icon: SettingsIcon },
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

	return (
		<div data-module="categories" className="space-y-6">
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					共 {categories?.length ?? 0} 个分类
				</p>
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
							organizationId={orgId}
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
	organizationId,
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
	organizationId: string;
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
