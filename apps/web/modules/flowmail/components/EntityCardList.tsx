"use client";

import { Badge } from "@repo/ui/components/badge";
import { Spinner, cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
	CheckCircle2Icon,
	ClockIcon,
	AlertCircleIcon,
	XCircleIcon,
	InboxIcon,
	MailIcon,
	MessageSquareIcon,
	SparklesIcon,
	XIcon,
	Trash2Icon,
	CheckSquareIcon,
	SquareIcon,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { DemoBanner } from "./DemoBanner";
import { InboxEmptyState } from "./InboxEmptyState";
import { toast } from "sonner";

const STATUS_CONFIG: Record<
	string,
	{
		variant: "success" | "info" | "warning" | "error";
		icon: typeof ClockIcon;
	}
> = {
	pending: { variant: "warning", icon: ClockIcon },
	approved: { variant: "success", icon: CheckCircle2Icon },
	rejected: { variant: "error", icon: XCircleIcon },
	in_progress: { variant: "info", icon: ClockIcon },
	completed: { variant: "success", icon: CheckCircle2Icon },
	blocked: { variant: "error", icon: AlertCircleIcon },
	open: { variant: "warning", icon: AlertCircleIcon },
	received: { variant: "info", icon: InboxIcon },
};

interface EntityCardListProps {
	selectedEntityId: string | null;
	onSelectEntity: (id: string) => void;
	categorySlug?: string;
	search?: string;
}

export function EntityCardList({
	selectedEntityId,
	onSelectEntity,
	categorySlug,
	search = "",
}: EntityCardListProps) {
	const { activeOrganization } = useActiveOrganization();
	const prevCountRef = useRef<number | null>(null);

	const { data, isLoading } = useQuery({
		...orpc.flowEntities.list.queryOptions({
			input: {
				organizationId: activeOrganization?.id ?? "",
				categorySlug,
				limit: 100,
				offset: 0,
			},
		}),
		refetchInterval: 5000,
	});

	const entities = data?.entities ?? [];

	// 检测新邮件到达，弹出 toast 提示
	useEffect(() => {
		if (prevCountRef.current === null) {
			prevCountRef.current = entities.length;
			return;
		}
		if (entities.length > prevCountRef.current) {
			const newCount = entities.length - prevCountRef.current;
			toast.success(`收到 ${newCount} 封新邮件`, {
				description: "已显示在列表中，点击卡片上的 ✨ 按钮运行 AI 分析",
				duration: 4000,
			});
		}
		prevCountRef.current = entities.length;
	}, [entities.length, toast]);

	const [activeTagId, setActiveTagId] = useState<string | null>(null);

	const hasDemo = entities.some((e) => {
		try {
			const fields =
				typeof e.extractedFields === "string"
					? JSON.parse(e.extractedFields)
					: e.extractedFields;
			return fields?._isDemo === true;
		} catch {
			return false;
		}
	});

	const allTags = useMemo(() => {
		const tagMap = new Map<string, { id: string; name: string; color: string; count: number }>();
		for (const e of entities) {
			for (const et of (e.tags ?? []) as TagInfo[]) {
				const existing = tagMap.get(et.tag.id);
				if (existing) {
					existing.count++;
				} else {
					tagMap.set(et.tag.id, { ...et.tag, count: 1 });
				}
			}
		}
		return [...tagMap.values()].sort((a, b) => b.count - a.count);
	}, [entities]);

	const filteredEntities = useMemo(() => {
		let result = entities;
		if (search) {
			const q = search.toLowerCase();
			result = result.filter(
				(e) =>
					e.title.toLowerCase().includes(q) ||
					e.aiSummary?.toLowerCase().includes(q),
			);
		}
		if (activeTagId) {
			result = result.filter((e) =>
				((e.tags ?? []) as TagInfo[]).some((et) => et.tag.id === activeTagId),
			);
		}
		return result;
	}, [entities, search, activeTagId]);

	const unanalyzedCount = useMemo(
		() => filteredEntities.filter((e) => !e.aiSummary).length,
		[filteredEntities],
	);

	const [selectMode, setSelectMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const toggleSelect = useCallback((id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	const selectAll = useCallback(() => {
		setSelectedIds(new Set(filteredEntities.map((e) => e.id)));
	}, [filteredEntities]);

	const exitSelectMode = useCallback(() => {
		setSelectMode(false);
		setSelectedIds(new Set());
	}, []);

	const queryClient = useQueryClient();

	const deleteMutation = useMutation(
		orpc.flowEntities.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.list.key() });
				toast.success("已删除");
			},
			onError: (err) => {
				toast.error(`删除失败：${err.message}`);
			},
		}),
	);

	const batchDeleteMutation = useMutation(
		orpc.flowEntities.deleteBatch.mutationOptions({
			onSuccess: (result) => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.list.key() });
				toast.success(`已删除 ${result.deleted} 个事项`);
				exitSelectMode();
			},
			onError: (err) => {
				toast.error(`批量删除失败：${err.message}`);
			},
		}),
	);

	const batchEnrichMutation = useMutation(
		orpc.flowEntities.enrichBatch.mutationOptions({
			onSuccess: (result) => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.list.key() });
				toast.success(`批量分析完成：${result.succeeded} 成功，${result.failed} 失败`, {
					duration: 5000,
				});
			},
			onError: (err) => {
				toast.error(`批量分析失败：${err.message}`);
			},
		}),
	);

	type CategoryInfo = { name: string; color: string };
	const grouped = !categorySlug;
	const categoryGroups: {
		category: CategoryInfo;
		items: typeof filteredEntities;
	}[] = [];

	if (grouped) {
		const groupMap = new Map<
			string,
			{ category: CategoryInfo; items: typeof filteredEntities }
		>();
		for (const entity of filteredEntities) {
			const cat = (entity as { category?: CategoryInfo | null })
				.category;
			const key = cat?.name ?? "未分类";
			const color = cat?.color ?? "#94a3b8";
			if (!groupMap.has(key)) {
				groupMap.set(key, {
					category: { name: key, color },
					items: [],
				});
			}
			groupMap.get(key)?.items.push(entity);
		}
		categoryGroups.push(...groupMap.values());
	}

	return (
		<div className="flex-1 overflow-y-auto relative">
			{/* Select mode toggle */}
			{filteredEntities.length > 0 && (
				<div className="flex items-center justify-between px-3 py-2 md:py-1.5 border-b bg-background/95 backdrop-blur-sm">
					{selectMode ? (
						<>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={selectedIds.size === filteredEntities.length ? () => setSelectedIds(new Set()) : selectAll}
									className="text-xs py-1 text-muted-foreground hover:text-foreground transition-colors"
								>
									{selectedIds.size === filteredEntities.length ? "取消全选" : "全选"}
								</button>
								<span className="text-xs text-muted-foreground">
									已选 {selectedIds.size} 项
								</span>
							</div>
							<div className="flex items-center gap-1.5">
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant="destructive"
											size="sm"
											className="h-7 gap-1 text-xs"
											disabled={selectedIds.size === 0 || batchDeleteMutation.isPending}
										>
											{batchDeleteMutation.isPending ? (
												<Spinner className="size-3" />
											) : (
												<Trash2Icon className="size-3" />
											)}
											删除 ({selectedIds.size})
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>确认删除</AlertDialogTitle>
											<AlertDialogDescription>
												将永久删除选中的 {selectedIds.size} 个事项及其所有邮件和附件，此操作不可撤销。
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>取消</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => {
													if (!activeOrganization?.id) { return; }
													batchDeleteMutation.mutate({
														organizationId: activeOrganization.id,
														entityIds: [...selectedIds],
													});
												}}
												className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
											>
												确认删除
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
								<Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exitSelectMode}>
									取消
								</Button>
							</div>
						</>
					) : (
						<>
							<span className="text-xs text-muted-foreground">{filteredEntities.length} 个事项</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 gap-1 text-xs"
								onClick={() => setSelectMode(true)}
							>
								<CheckSquareIcon className="size-3" />
								选择
							</Button>
						</>
					)}
				</div>
			)}
			{unanalyzedCount > 0 && (
				<div className="flex items-center justify-between px-3 py-2.5 md:py-2 border-b bg-amber-50/50 dark:bg-amber-950/20">
					<span className="text-xs text-amber-700 dark:text-amber-400">
						{unanalyzedCount} 封邮件待 AI 分析
					</span>
					<Button
						variant="outline"
						size="sm"
						className="h-7 gap-1.5 text-xs"
						disabled={batchEnrichMutation.isPending}
						onClick={() => {
							if (!activeOrganization?.id) {
								return;
							}
							toast.loading("正在批量 AI 分析...", { id: "batch-enrich" });
							batchEnrichMutation.mutate({
								organizationId: activeOrganization.id,
								limit: 20,
							}, {
								onSettled: () => toast.dismiss("batch-enrich"),
							});
						}}
					>
						{batchEnrichMutation.isPending ? (
							<Spinner className="size-3" />
						) : (
							<SparklesIcon className="size-3" />
						)}
						全部分析
					</Button>
				</div>
			)}
			{allTags.length > 0 && (
				<div className="flex items-center gap-1 px-3 py-1.5 border-b overflow-x-auto scrollbar-none">
					{allTags.slice(0, 8).map((tag) => (
						<button
							key={tag.id}
							type="button"
							className={cn(
								"inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors border",
								activeTagId === tag.id
									? "border-current"
									: "border-transparent opacity-70 hover:opacity-100",
							)}
							style={{
								backgroundColor: `${tag.color}15`,
								color: tag.color,
							}}
							onClick={() => setActiveTagId(activeTagId === tag.id ? null : tag.id)}
						>
							{tag.name}
							{activeTagId === tag.id && <XIcon className="size-2.5" />}
						</button>
					))}
				</div>
			)}
			{isLoading ? (
				<div className="flex items-center justify-center py-20">
					<Spinner className="size-4 text-primary" />
				</div>
			) : filteredEntities.length === 0 ? (
				search ? (
					<div className="flex flex-col items-center justify-center py-20 px-6 text-center">
						<InboxIcon className="size-10 text-muted-foreground/30 mb-3" />
						<p className="text-sm text-muted-foreground">
							无匹配结果
						</p>
					</div>
				) : (
					<InboxEmptyState />
				)
			) : (
				<>
				{hasDemo && (
					<div className="px-3 py-2">
						<DemoBanner />
					</div>
				)}
				{grouped ? (
				categoryGroups.map((group) => (
					<div key={group.category.name}>
						<div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-muted/50 backdrop-blur-sm border-b">
							<div
								className="size-2 rounded-full shrink-0"
								style={{
									backgroundColor: group.category.color,
								}}
							/>
							<span className="text-[11px] font-semibold text-muted-foreground">
								{group.category.name}
							</span>
							<span className="text-[10px] text-muted-foreground/60">
								{group.items.length}
							</span>
						</div>
						{group.items.map((entity) => (
							<EntityCard
								key={entity.id}
								entity={entity}
								isSelected={entity.id === selectedEntityId}
								onSelect={() => selectMode ? toggleSelect(entity.id) : onSelectEntity(entity.id)}
								selectMode={selectMode}
								isChecked={selectedIds.has(entity.id)}
								onDelete={(id) => deleteMutation.mutate({ entityId: id })}
							/>
						))}
					</div>
				))
			) : (
				filteredEntities.map((entity) => (
					<EntityCard
						key={entity.id}
						entity={entity}
						isSelected={entity.id === selectedEntityId}
						onSelect={() => selectMode ? toggleSelect(entity.id) : onSelectEntity(entity.id)}
						selectMode={selectMode}
						isChecked={selectedIds.has(entity.id)}
						onDelete={(id) => deleteMutation.mutate({ entityId: id })}
					/>
				))
			)}
				</>
			)}
		</div>
	);
}

interface TagInfo {
	tag: { id: string; name: string; color: string };
}

function EntityCard({
	entity,
	isSelected,
	onSelect,
	selectMode = false,
	isChecked = false,
	onDelete,
}: {
	entity: {
		id: string;
		title: string;
		status: string;
		type: string;
		aiSummary: string | null;
		updatedAt: Date | string;
		category?: { name: string; color: string; slug: string } | null;
		tags?: TagInfo[];
		_count?: { threads?: number; timeline?: number };
	};
	isSelected: boolean;
	onSelect: () => void;
	selectMode?: boolean;
	isChecked?: boolean;
	onDelete?: (id: string) => void;
}) {
	const queryClient = useQueryClient();
	const statusCfg = STATUS_CONFIG[entity.status] ?? STATUS_CONFIG.pending;
	const catColor = entity.category?.color ?? "#94a3b8";
	const catName = entity.category?.name ?? entity.type;
	const threadCount = entity._count?.threads ?? 0;
	const timelineCount = entity._count?.timeline ?? 0;
	const tags = entity.tags ?? [];
	const needsAI = !entity.aiSummary;

	const enrichMutation = useMutation(
		orpc.flowEntities.enrich.mutationOptions({
			onSuccess: (result) => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.list.key() });
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.get.key() });
				toast.success(`AI 分析完成：${result.categorySlug}`, {
					description: result.summary?.slice(0, 80),
				});
			},
			onError: (err) => {
				toast.error(`AI 分析失败：${err.message}`);
			},
		}),
	);

	return (
		// biome-ignore lint/a11y/useSemanticElements: div needed to avoid button-in-button hydration error from nested AlertDialogTrigger
		<div
			role="button"
			tabIndex={0}
			data-entity-card
			onClick={onSelect}
			onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
			className={cn(
				"w-full text-left px-3 py-3.5 md:py-3 border-b transition-colors flex gap-2.5 active:bg-muted/70 group/card cursor-pointer",
				isSelected
					? "bg-primary/5 border-l-2 border-l-primary"
					: "hover:bg-muted/50 border-l-2 border-l-transparent",
				isChecked && "bg-primary/10",
			)}
		>
			{selectMode ? (
				<div className="shrink-0 mt-1">
					{isChecked ? (
						<CheckSquareIcon className="size-4 text-primary" />
					) : (
						<SquareIcon className="size-4 text-muted-foreground" />
					)}
				</div>
			) : (
				<div
					className="w-1 shrink-0 rounded-full mt-1"
					style={{
						backgroundColor: needsAI ? "#94a3b8" : catColor,
						height: "calc(100% - 4px)",
					}}
				/>
			)}

			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5 mb-0.5">
					{needsAI ? (
						<span className="text-[10px] font-medium text-muted-foreground">
							待分析
						</span>
					) : (
						<span
							className="text-[10px] font-medium uppercase"
							style={{ color: catColor }}
						>
							{catName}
						</span>
					)}
					<Badge
						status={needsAI ? "info" : statusCfg.variant}
						className="text-[10px] px-1 py-0"
					>
						{needsAI ? "未分析" : entity.status}
					</Badge>
				</div>
				<p className="text-sm font-medium truncate">{entity.title}</p>
				{entity.aiSummary ? (
					<p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
						{entity.aiSummary}
					</p>
				) : (
					<div className="flex items-center gap-1.5 mt-1">
						<Button
							variant="outline"
							size="sm"
							className="h-6 px-2 gap-1 text-[11px]"
							disabled={enrichMutation.isPending}
							onClick={(e) => {
								e.stopPropagation();
								enrichMutation.mutate({ entityId: entity.id });
							}}
						>
							{enrichMutation.isPending ? (
								<Spinner className="size-3" />
							) : (
								<SparklesIcon className="size-3" />
							)}
							{enrichMutation.isPending ? "分析中..." : "AI 分析"}
						</Button>
						<span className="text-[10px] text-muted-foreground/50">
							点击运行 AI 分类和摘要
						</span>
					</div>
				)}
				{tags.length > 0 && (
					<div className="flex items-center gap-1 mt-1 flex-wrap">
						{tags.slice(0, 3).map((et) => (
							<span
								key={et.tag.id}
								className="inline-flex items-center rounded px-1.5 py-0 text-[10px] font-medium"
								style={{
									backgroundColor: `${et.tag.color}15`,
									color: et.tag.color,
								}}
							>
								{et.tag.name}
							</span>
						))}
						{tags.length > 3 && (
							<span className="text-[10px] text-muted-foreground/50">
								+{tags.length - 3}
							</span>
						)}
					</div>
				)}
				<div className="flex items-center gap-2.5 mt-1 text-[10px] text-muted-foreground/60">
					<span>{new Date(entity.updatedAt).toLocaleDateString()}</span>
					{threadCount > 1 && (
						<span className="inline-flex items-center gap-0.5">
							<MailIcon className="size-2.5" />
							{threadCount}
						</span>
					)}
					{timelineCount > 0 && (
						<span className="inline-flex items-center gap-0.5">
							<MessageSquareIcon className="size-2.5" />
							{timelineCount}
						</span>
					)}
					{!selectMode && onDelete && (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<button
									type="button"
									onClick={(e) => e.stopPropagation()}
									className="ml-auto md:opacity-0 md:group-hover/card:opacity-100 transition-opacity p-1 md:p-0.5 rounded hover:bg-destructive/10 hover:text-destructive"
									title="删除"
								>
									<Trash2Icon className="size-3.5 md:size-3" />
								</button>
							</AlertDialogTrigger>
							<AlertDialogContent onClick={(e) => e.stopPropagation()}>
								<AlertDialogHeader>
									<AlertDialogTitle>确认删除</AlertDialogTitle>
									<AlertDialogDescription>
										将永久删除「{entity.title}」及其所有邮件和附件，此操作不可撤销。
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>取消</AlertDialogCancel>
									<AlertDialogAction
										onClick={() => onDelete(entity.id)}
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
									>
										确认删除
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</div>
			</div>
		</div>
	);
}
