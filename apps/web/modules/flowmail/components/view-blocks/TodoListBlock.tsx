"use client";

import { Card } from "@repo/ui/components/card";
import { cn } from "@repo/ui";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	CircleIcon,
	ClockIcon,
	AlertCircleIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { TodoListBlock as Spec } from "@repo/api";

export interface TodoItemView {
	id: string;
	text: string;
	status: "pending" | "in_progress" | "blocked" | "completed";
	source?: string;
	dueDate?: string;
}

const STATUS_META: Record<TodoItemView["status"], { label: string; icon: typeof CircleIcon; color: string; order: number }> = {
	blocked: { label: "阻塞", icon: AlertCircleIcon, color: "text-red-500", order: 0 },
	in_progress: { label: "进行中", icon: ClockIcon, color: "text-amber-500", order: 1 },
	pending: { label: "待办", icon: CircleIcon, color: "text-muted-foreground", order: 2 },
	completed: { label: "已完成", icon: CheckCircle2Icon, color: "text-emerald-500", order: 3 },
};

export function TodoListBlock({
	block,
	entityId,
	autoItems,
}: {
	block: Spec;
	entityId?: string;
	autoItems?: TodoItemView[];
}) {
	const queryClient = useQueryClient();
	const items = useMemo<TodoItemView[]>(() => {
		if (block.source === "manual") {
			return block.items ?? [];
		}
		return autoItems ?? [];
	}, [block.source, block.items, autoItems]);

	const [completedLocal, setCompletedLocal] = useState<Set<string>>(new Set());

	const noteMutation = useMutation(
		orpc.flowEntities.addTimelineEvent.mutationOptions({
			onSuccess: () => {
				if (entityId) {
					queryClient.invalidateQueries({
						queryKey: orpc.flowEntities.get.key({ input: { entityId } }),
					});
				}
			},
			onError: (err) => {
				toast.error(`标记失败：${err.message}`);
			},
		}),
	);

	function handleToggle(item: TodoItemView) {
		if (!entityId) {
			return;
		}
		const isCompleted = item.status === "completed" || completedLocal.has(item.id);
		if (isCompleted) {
			return;
		}
		setCompletedLocal((s) => new Set(s).add(item.id));
		noteMutation.mutate({
			entityId,
			type: "action_taken",
			content: `✓ 完成待办：${item.text}`,
			metadata: { kind: "todo_completed", todoId: item.id, source: item.source },
		});
		toast.success("已标记完成");
	}

	const grouped = useMemo(() => {
		if (block.groupBy === "none") {
			return [{ key: "all", label: "", items }];
		}
		const map = new Map<TodoItemView["status"], TodoItemView[]>();
		for (const it of items) {
			const status = completedLocal.has(it.id) ? "completed" : it.status;
			const arr = map.get(status) ?? [];
			arr.push(it);
			map.set(status, arr);
		}
		return Array.from(map.entries())
			.sort((a, b) => STATUS_META[a[0]].order - STATUS_META[b[0]].order)
			.map(([k, v]) => ({ key: k, label: STATUS_META[k].label, items: v }));
	}, [items, block.groupBy, completedLocal]);

	if (items.length === 0) {
		return (
			<Card className="p-4">
				{block.title && <h4 className="mb-2 text-sm font-semibold">{block.title}</h4>}
				<p className="py-4 text-center text-xs text-muted-foreground">
					暂无待办
					{block.source === "auto" && "（AI 还没从邮件里抽到 nextActions/blockers）"}
				</p>
			</Card>
		);
	}

	return (
		<Card className="p-4">
			{block.title && (
				<h4 className="mb-3 text-sm font-semibold flex items-center justify-between">
					<span>{block.title}</span>
					<span className="text-xs font-normal text-muted-foreground">
						{items.filter((i) => i.status !== "completed" && !completedLocal.has(i.id)).length} / {items.length}
					</span>
				</h4>
			)}
			<div className="space-y-3">
				{grouped.map((group) => (
					<div key={group.key}>
						{group.label && (
							<p className="mb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
								{group.label}（{group.items.length}）
							</p>
						)}
						<ul className="space-y-1">
							{group.items.map((item) => {
								const status = completedLocal.has(item.id) ? "completed" : item.status;
								const meta = STATUS_META[status];
								const Icon = meta.icon;
								const isDone = status === "completed";
								return (
									<li
										key={item.id}
										className={cn(
											"group flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50",
											isDone && "opacity-60",
										)}
									>
										<button
											type="button"
											onClick={() => handleToggle(item)}
											disabled={isDone || !entityId}
											className={cn(
												"mt-0.5 shrink-0 transition-colors",
												!isDone && "hover:text-emerald-600 cursor-pointer",
											)}
											title={isDone ? "已完成" : "点击标记完成"}
										>
											<Icon className={cn("size-4", meta.color)} />
										</button>
										<div className="flex-1 min-w-0">
											<p
												className={cn(
													"leading-snug",
													isDone && "line-through text-muted-foreground",
												)}
											>
												{item.text}
											</p>
											<div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
												{item.source && <span>来自：{item.source}</span>}
												{item.dueDate && <span>截止：{item.dueDate}</span>}
											</div>
										</div>
									</li>
								);
							})}
						</ul>
					</div>
				))}
			</div>
		</Card>
	);
}
