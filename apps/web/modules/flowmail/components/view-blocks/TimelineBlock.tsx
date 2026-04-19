"use client";

import { Card } from "@repo/ui/components/card";
import { Spinner } from "@repo/ui";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TimelineBlock as Spec } from "@repo/api";
import { EntityTimeline } from "../EntityTimeline";

export function TimelineBlock({
	block,
	entityId,
	entityTitle,
}: {
	block: Spec;
	entityId: string;
	entityTitle: string;
}) {
	const { data: entity, isLoading } = useQuery({
		...orpc.flowEntities.get.queryOptions({ input: { entityId } }),
	});

	const filteredEvents = useMemo(() => {
		if (!entity?.timeline) {
			return [];
		}
		let events = entity.timeline.map((e) => ({
			...e,
			createdAt: e.createdAt.toString(),
			actor: e.actor
				? { id: e.actor.id, name: e.actor.name ?? "", image: e.actor.image }
				: null,
		}));

		const f = block.filter;
		if (f?.eventTypes && f.eventTypes.length > 0) {
			events = events.filter((e) => f.eventTypes!.includes(e.type));
		}
		if (f?.sinceDays != null) {
			const cutoff = Date.now() - f.sinceDays * 86400000;
			events = events.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
		}
		if (f?.month) {
			events = events.filter((e) =>
				new Date(e.createdAt).toISOString().slice(0, 7) === f.month,
			);
		}
		if (block.limit) {
			events = events.slice(0, block.limit);
		}
		return events;
	}, [entity?.timeline, block.filter, block.limit]);

	const groups = useMemo(() => {
		if (block.groupBy === "none" || filteredEvents.length === 0) {
			return [{ key: "all", label: "", events: filteredEvents }];
		}
		const map = new Map<string, typeof filteredEvents>();
		for (const ev of filteredEvents) {
			const d = new Date(ev.createdAt);
			let key: string;
			if (block.groupBy === "month") {
				key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
			} else if (block.groupBy === "week") {
				const weekStart = new Date(d);
				weekStart.setDate(d.getDate() - d.getDay());
				key = `${weekStart.getFullYear()}-W${weekStart.toISOString().slice(5, 10)}`;
			} else {
				key = "未知";
			}
			const arr = map.get(key) ?? [];
			arr.push(ev);
			map.set(key, arr);
		}
		return Array.from(map.entries())
			.sort((a, b) => (a[0] < b[0] ? 1 : -1))
			.map(([key, events]) => ({ key, label: key, events }));
	}, [filteredEvents, block.groupBy]);

	if (isLoading) {
		return (
			<Card className="p-4">
				<Spinner className="mx-auto size-5" />
			</Card>
		);
	}
	if (!entity) {
		return null;
	}

	return (
		<Card className="p-4">
			{block.title && (
				<h4 className="mb-3 text-sm font-semibold">{block.title}</h4>
			)}

			{block.groupBy === "none" ? (
				<EntityTimeline
					entityId={entityId}
					entityTitle={entityTitle}
					events={filteredEvents}
					entityType={entity.type}
					status={entity.status}
					extractedFields={entity.extractedFields as string | null}
				/>
			) : (
				<div className="space-y-5">
					{groups.map((g) => (
						<div key={g.key}>
							<p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1">
								{g.label}（{g.events.length}）
							</p>
							<EntityTimeline
								entityId={entityId}
								entityTitle={entityTitle}
								events={g.events}
								entityType={entity.type}
								status={entity.status}
								extractedFields={entity.extractedFields as string | null}
							/>
						</div>
					))}
				</div>
			)}
		</Card>
	);
}
