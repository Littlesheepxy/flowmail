"use client";

import type { ViewBlock } from "@repo/api";
import { useMemo } from "react";
import { aggregateAutoTodos } from "./aggregate-todos";
import { KpiCardsBlock } from "./KpiCardsBlock";
import { QuickActionsBlock } from "./QuickActionsBlock";
import { SummaryBlock } from "./SummaryBlock";
import { TableBlock } from "./TableBlock";
import { TimelineBlock } from "./TimelineBlock";
import { TodoListBlock } from "./TodoListBlock";

interface ViewRendererProps {
	blocks: ViewBlock[];
	entityId: string;
	entityTitle: string;
	entity?: {
		id: string;
		extractedFields?: string | null;
		timeline?: Array<{ id: string; type: string; metadata?: string | null; createdAt: Date | string }>;
	};
}

export function ViewRenderer({ blocks, entityId, entityTitle, entity }: ViewRendererProps) {
	const autoTodos = useMemo(
		() => (entity ? aggregateAutoTodos(entity) : []),
		[entity],
	);

	if (blocks.length === 0) {
		return (
			<div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
				这个视图还是空的。问 Agent：「给这个事项加一个本月待办列表」
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{blocks.map((block, idx) => {
				const key = `${block.type}-${block.id ?? idx}`;
				switch (block.type) {
					case "summary":
						return <SummaryBlock key={key} block={block} />;
					case "kpi_cards":
						return <KpiCardsBlock key={key} block={block} />;
					case "todo_list":
						return (
							<TodoListBlock
								key={key}
								block={block}
								entityId={entityId}
								autoItems={autoTodos}
							/>
						);
					case "timeline":
						return (
							<TimelineBlock
								key={key}
								block={block}
								entityId={entityId}
								entityTitle={entityTitle}
							/>
						);
					case "table":
						return <TableBlock key={key} block={block} />;
					case "quick_actions":
						return (
							<QuickActionsBlock
								key={key}
								block={block}
								entityId={entityId}
								entityTitle={entityTitle}
							/>
						);
					default:
						return null;
				}
			})}
		</div>
	);
}
