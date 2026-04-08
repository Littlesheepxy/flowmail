"use client";

import { Button } from "@repo/ui/components/button";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import {
	ArrowRightIcon,
	BotIcon,
	InboxIcon,
	MailIcon,
	SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DemoSceneDialog } from "./DemoSceneDialog";

const CATEGORY_ITEMS = [
	{ label: "审批", desc: "请审批、签字确认", color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
	{ label: "汇报", desc: "周报、进展更新", color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400" },
	{ label: "问题", desc: "工单、Bug、投诉", color: "bg-red-500", textColor: "text-red-600 dark:text-red-400" },
	{ label: "反馈", desc: "建议、评审意见", color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
] as const;

export function InboxEmptyState() {
	const { activeOrganization } = useActiveOrganization();
	const [demoDialogOpen, setDemoDialogOpen] = useState(false);
	const basePath = activeOrganization
		? `/app/${activeOrganization.slug}`
		: "/app";

	return (
		<div data-inbox-empty="true" className="flex flex-col items-center px-5 py-10">
			<div className="relative mb-4">
				<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
					<MailIcon className="h-6 w-6 text-primary" />
				</div>
				<div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-sm">
					<SparklesIcon className="h-3 w-3 text-primary-foreground" />
				</div>
			</div>

			<h3 className="text-base font-semibold text-foreground">
				邮件进来，事项出去
			</h3>
			<p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground max-w-[240px]">
				AI 自动识别邮件意图，分类为结构化事项并追踪状态
			</p>

			{/* Category explanation */}
			<div className="mt-5 w-full">
				<p className="text-[11px] font-medium text-muted-foreground mb-2 px-1">
					AI 自动将邮件分为 4 类
				</p>
				<div className="grid grid-cols-2 gap-1.5">
					{CATEGORY_ITEMS.map((cat) => (
						<div
							key={cat.label}
							className="flex items-center gap-2 rounded-lg border bg-card/50 px-2.5 py-2"
						>
							<div className={`size-2 rounded-full shrink-0 ${cat.color}`} />
							<div className="min-w-0">
								<span className={`text-[11px] font-semibold ${cat.textColor}`}>
									{cat.label}
								</span>
								<p className="text-[10px] text-muted-foreground/70 leading-tight">
									{cat.desc}
								</p>
							</div>
						</div>
					))}
				</div>
				<p className="text-[10px] text-muted-foreground/50 mt-2 px-1 text-center">
					分类由 AI 判断，你也可以随时手动修改或添加标签
				</p>
			</div>

			<div className="mt-5 flex w-full flex-col gap-2">
				<Button asChild size="sm" className="w-full gap-1.5">
					<Link href={`${basePath}/connections`}>
						<InboxIcon className="h-3.5 w-3.5" />
						丢一封邮件进来试试
						<ArrowRightIcon className="h-3.5 w-3.5" />
					</Link>
				</Button>

				<Button
					variant="outline"
					size="sm"
					className="w-full gap-1.5"
					data-demo-dialog-trigger
					onClick={() => setDemoDialogOpen(true)}
				>
					<BotIcon className="h-3.5 w-3.5" />
					体验 Demo 数据
				</Button>
			</div>

			<DemoSceneDialog
				open={demoDialogOpen}
				onOpenChange={setDemoDialogOpen}
			/>
		</div>
	);
}
