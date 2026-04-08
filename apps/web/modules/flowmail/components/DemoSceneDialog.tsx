"use client";

import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Spinner, cn } from "@repo/ui";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	CheckCircleIcon,
	ClipboardCheckIcon,
	FileTextIcon,
	SparklesIcon,
} from "lucide-react";
import { useState } from "react";

interface DemoSceneDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const SCENES = [
	{
		id: "approval" as const,
		icon: ClipboardCheckIcon,
		label: "审批场景",
		desc: "预算申请、采购审批、差旅报销等",
		color: "text-blue-500",
		bg: "bg-blue-500/10",
		border: "border-blue-500/30",
	},
	{
		id: "report" as const,
		icon: FileTextIcon,
		label: "汇报场景",
		desc: "周报、月报、进度汇报（含多进展项）",
		color: "text-emerald-500",
		bg: "bg-emerald-500/10",
		border: "border-emerald-500/30",
	},
	{
		id: "issue" as const,
		icon: AlertTriangleIcon,
		label: "问题场景",
		desc: "客户反馈、技术问题、流程卡点",
		color: "text-amber-500",
		bg: "bg-amber-500/10",
		border: "border-amber-500/30",
	},
] as const;

type SceneId = (typeof SCENES)[number]["id"];

export function DemoSceneDialog({ open, onOpenChange }: DemoSceneDialogProps) {
	const { activeOrganization } = useActiveOrganization();
	const queryClient = useQueryClient();
	const [selected, setSelected] = useState<Set<SceneId>>(new Set(["approval", "report"]));

	const seedMutation = useMutation(
		orpc.flowEntities.seedDemo.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.list.queryOptions({
						input: {
							organizationId: activeOrganization?.id ?? "",
							limit: 100,
							offset: 0,
						},
					}).queryKey,
				});
				onOpenChange(false);
			},
		}),
	);

	const toggleScene = (id: SceneId) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const handleGenerate = () => {
		if (!activeOrganization || selected.size === 0) {
			return;
		}
		seedMutation.mutate({
			organizationId: activeOrganization.id,
			scenes: [...selected],
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<SparklesIcon className="h-5 w-5 text-primary" />
						选择 Demo 场景
					</DialogTitle>
					<DialogDescription>
						生成模拟数据，快速体验 Flowmail 的 AI 邮件处理能力
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-2.5 py-4">
					{SCENES.map((scene) => {
						const isSelected = selected.has(scene.id);
						return (
							<button
								key={scene.id}
								type="button"
								onClick={() => toggleScene(scene.id)}
								className={cn(
									"flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
									isSelected
										? `${scene.border} ${scene.bg}`
										: "border-border hover:border-border/80 hover:bg-accent/50",
								)}
							>
								<div
									className={cn(
										"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
										isSelected ? scene.bg : "bg-muted",
									)}
								>
									<scene.icon
										className={cn(
											"h-4.5 w-4.5",
											isSelected
												? scene.color
												: "text-muted-foreground",
										)}
									/>
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium">
											{scene.label}
										</span>
										{isSelected && (
											<CheckCircleIcon
												className={cn(
													"h-3.5 w-3.5",
													scene.color,
												)}
											/>
										)}
									</div>
									<p className="mt-0.5 text-xs text-muted-foreground truncate">
										{scene.desc}
									</p>
								</div>
							</button>
						);
					})}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						取消
					</Button>
					<Button
						onClick={handleGenerate}
						disabled={
							selected.size === 0 || seedMutation.isPending
						}
						className="gap-2"
					>
						{seedMutation.isPending ? (
							<Spinner className="size-4" />
						) : (
							<SparklesIcon className="h-4 w-4" />
						)}
						生成 {selected.size} 个场景
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
