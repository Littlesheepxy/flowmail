"use client";

import { Badge } from "@repo/ui/components/badge";
import { Spinner, cn } from "@repo/ui";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	ClockIcon,
	AlertCircleIcon,
	XCircleIcon,
	InboxIcon,
} from "lucide-react";

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

	const filteredEntities = search
		? entities.filter(
				(e) =>
					e.title.toLowerCase().includes(search.toLowerCase()) ||
					e.aiSummary?.toLowerCase().includes(search.toLowerCase()),
			)
		: entities;

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
			groupMap.get(key)!.items.push(entity);
		}
		categoryGroups.push(...groupMap.values());
	}

	return (
		<div className="flex-1 overflow-y-auto">
			{isLoading ? (
				<div className="flex items-center justify-center py-20">
					<Spinner className="size-4 text-primary" />
				</div>
			) : filteredEntities.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-20 px-6 text-center">
					<InboxIcon className="size-10 text-muted-foreground/30 mb-3" />
					<p className="text-sm text-muted-foreground">
						{search
							? "无匹配结果"
							: "还没有邮件。连接邮箱开始处理。"}
					</p>
				</div>
			) : grouped ? (
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
								onSelect={() => onSelectEntity(entity.id)}
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
						onSelect={() => onSelectEntity(entity.id)}
					/>
				))
			)}
		</div>
	);
}

function EntityCard({
	entity,
	isSelected,
	onSelect,
}: {
	entity: {
		id: string;
		title: string;
		status: string;
		type: string;
		aiSummary: string | null;
		updatedAt: Date | string;
		category?: { name: string; color: string; slug: string } | null;
	};
	isSelected: boolean;
	onSelect: () => void;
}) {
	const statusCfg = STATUS_CONFIG[entity.status] ?? STATUS_CONFIG.pending;
	const catColor = entity.category?.color ?? "#94a3b8";
	const catName = entity.category?.name ?? entity.type;

	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"w-full text-left px-3 py-3 border-b transition-colors flex gap-2.5",
				isSelected
					? "bg-primary/5 border-l-2 border-l-primary"
					: "hover:bg-muted/50 border-l-2 border-l-transparent",
			)}
		>
			<div
				className="w-1 shrink-0 rounded-full mt-1"
				style={{
					backgroundColor: catColor,
					height: "calc(100% - 4px)",
				}}
			/>

			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5 mb-0.5">
					<span
						className="text-[10px] font-medium uppercase"
						style={{ color: catColor }}
					>
						{catName}
					</span>
					<Badge
						status={statusCfg.variant}
						className="text-[10px] px-1 py-0"
					>
						{entity.status}
					</Badge>
				</div>
				<p className="text-sm font-medium truncate">{entity.title}</p>
				{entity.aiSummary && (
					<p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
						{entity.aiSummary}
					</p>
				)}
				<p className="text-[10px] text-muted-foreground/60 mt-1">
					{new Date(entity.updatedAt).toLocaleDateString()}
				</p>
			</div>
		</button>
	);
}
