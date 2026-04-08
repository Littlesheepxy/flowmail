"use client";

import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Spinner } from "@repo/ui";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	CopyIcon,
	InboxIcon,
	MailIcon,
	ShieldCheckIcon,
} from "lucide-react";
import { useState } from "react";

export function InboundDropBox() {
	const { activeOrganization } = useActiveOrganization();
	const [copied, setCopied] = useState(false);

	const { data: addressData, isLoading: addressLoading } = useQuery(
		orpc.emailConnections.getInboundAddress.queryOptions({
			input: { organizationId: activeOrganization?.id ?? "" },
			enabled: !!activeOrganization?.id,
		}),
	);

	const { data: statusData, isLoading: statusLoading } = useQuery(
		orpc.emailConnections.checkInboundStatus.queryOptions({
			input: { organizationId: activeOrganization?.id ?? "" },
			enabled: !!activeOrganization?.id,
			refetchInterval: 5000,
		}),
	);

	async function handleCopy() {
		if (!addressData?.address) {
			return;
		}
		await navigator.clipboard.writeText(addressData.address);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	if (addressLoading) {
		return (
			<Card className="p-6">
				<div className="flex items-center justify-center py-8">
					<Spinner />
				</div>
			</Card>
		);
	}

	const hasReceived = statusData?.hasReceived ?? false;

	return (
		<Card className="overflow-hidden border-primary/20">
			<div className="bg-linear-to-r from-primary to-primary/80 px-6 py-4">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
						<InboxIcon className="h-5 w-5 text-white" />
					</div>
					<div>
						<h3 className="font-semibold text-base text-white">
							丢一封邮件进来试试
						</h3>
						<p className="text-sm text-white/70">
							10 秒体验 AI 邮件解析，无需任何配置
						</p>
					</div>
				</div>
			</div>

			<div className="p-6 space-y-5">
				{/* Step 1: Copy address */}
				<div className="space-y-2">
					<div className="flex items-center gap-2 text-sm font-medium">
						<span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold">
							1
						</span>
						打开你的邮箱，转发一封邮件到
					</div>
					<div className="flex items-center gap-2">
						<code className="flex-1 rounded-lg border bg-muted/50 px-4 py-2.5 font-mono text-sm select-all">
							{addressData?.address ?? "加载中..."}
						</code>
						<Button
							variant="outline"
							size="sm"
							onClick={handleCopy}
							className="shrink-0"
						>
							{copied ? (
								<CheckCircle2Icon className="h-4 w-4 text-green-500" />
							) : (
								<CopyIcon className="h-4 w-4" />
							)}
							{copied ? "已复制" : "复制"}
						</Button>
					</div>
				</div>

				{/* Step 2: Wait for result */}
				<div className="space-y-2">
					<div className="flex items-center gap-2 text-sm font-medium">
						<span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold">
							2
						</span>
						等待 AI 解析结果
					</div>

					{statusLoading ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Spinner className="h-4 w-4" />
							检测中...
						</div>
					) : hasReceived ? (
						<div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4 space-y-2">
							<div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
								<CheckCircle2Icon className="h-4 w-4" />
								已收到 {statusData?.totalCount} 封邮件
							</div>
							{statusData?.latest?.entity && (
								<div className="text-sm text-muted-foreground space-y-1">
									<p>
										<span className="font-medium">最新:</span>{" "}
										{statusData.latest.entity.title}
									</p>
									{statusData.latest.entity.aiSummary && (
										<p className="text-xs line-clamp-2">
											{statusData.latest.entity.aiSummary}
										</p>
									)}
								</div>
							)}
						</div>
					) : (
						<div className="rounded-lg border border-dashed p-4">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<MailIcon className="h-4 w-4 animate-pulse" />
								等待接收邮件...转发后通常几秒内即可看到结果
							</div>
						</div>
					)}
				</div>

				{/* Trust statement */}
				<div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
					<ShieldCheckIcon className="h-4 w-4 shrink-0 mt-0.5" />
					<span>
						Flowmail 仅解析邮件内容用于生成待办和提醒，不会代你发送任何邮件。
						你的数据经过加密存储，可随时删除。
					</span>
				</div>
			</div>
		</Card>
	);
}
