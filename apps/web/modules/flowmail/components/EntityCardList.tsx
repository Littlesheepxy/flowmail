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
	MailIcon,
	MessageSquareIcon,
	XIcon,
} from "lucide-react";
import { useState, useMemo } from "react";
import { DemoBanner } from "./DemoBanner";
import { InboxEmptyState } from "./InboxEmptyState";

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
		<div className="flex-1 overflow-y-auto">
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
}) {
	const statusCfg = STATUS_CONFIG[entity.status] ?? STATUS_CONFIG.pending;
	const catColor = entity.category?.color ?? "#94a3b8";
	const catName = entity.category?.name ?? entity.type;
	const threadCount = entity._count?.threads ?? 0;
	const timelineCount = entity._count?.timeline ?? 0;
	const tags = entity.tags ?? [];

	return (
		<button
			type="button"
			data-entity-card
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
				</div>
			</div>
		</button>
	);
}
