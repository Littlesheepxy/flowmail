"use client";

import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { cn } from "@repo/ui";
import { ZapIcon } from "lucide-react";
import type { QuickActionsBlock as Spec } from "@repo/api";
import { useAgent } from "../AgentProvider";

const TONE_CLS: Record<NonNullable<Spec["actions"][number]["tone"]>, string> = {
	primary: "bg-primary text-primary-foreground hover:bg-primary/90",
	secondary: "",
	destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

export function QuickActionsBlock({
	block,
	entityId,
	entityTitle,
}: {
	block: Spec;
	entityId?: string;
	entityTitle?: string;
}) {
	const { triggerAgentPrompt } = useAgent();

	function handleClick(action: Spec["actions"][number]) {
		const contextLine =
			entityId && entityTitle
				? `\n\n（当前事项：「${entityTitle}」 ID=${entityId}）`
				: "";
		triggerAgentPrompt({
			text: action.prompt + contextLine,
			entityId,
		});
	}

	if (block.actions.length === 0) {
		return null;
	}

	return (
		<Card className="p-4">
			{block.title && (
				<div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
					<ZapIcon className="size-4 text-primary" />
					{block.title}
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				{block.actions.map((action) => (
					<Button
						key={action.label}
						variant={action.tone === "secondary" || !action.tone ? "outline" : "default"}
						size="sm"
						className={cn(action.tone && TONE_CLS[action.tone])}
						onClick={() => handleClick(action)}
					>
						{action.label}
					</Button>
				))}
			</div>
		</Card>
	);
}
