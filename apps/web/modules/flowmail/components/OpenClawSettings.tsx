"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { cn } from "@repo/ui";
import {
	CopyIcon,
	CheckIcon,
	ExternalLinkIcon,
	PlugIcon,
	ShieldCheckIcon,
	BookOpenIcon,
} from "lucide-react";
import { useState, useCallback } from "react";

interface OpenClawSettingsProps {
	organizationId: string;
	mcpEndpointUrl: string;
}

export function OpenClawSettings({ organizationId, mcpEndpointUrl }: OpenClawSettingsProps) {
	const [copied, setCopied] = useState<string | null>(null);

	const copyToClipboard = useCallback((text: string, key: string) => {
		navigator.clipboard.writeText(text);
		setCopied(key);
		setTimeout(() => setCopied(null), 2000);
	}, []);

	const mcpJsonConfig = JSON.stringify(
		{
			mcpServers: {
				flowmail: {
					url: mcpEndpointUrl,
					transport: "streamable-http",
				},
			},
		},
		null,
		2,
	);

	const openclawSkillConfig = `# In your OpenClaw skills directory:
# skills/flowmail/SKILL.md is already provided by Flowmail
# Just set the environment variable:

export FLOWMAIL_MCP_URL="${mcpEndpointUrl}"`;

	return (
		<div className="space-y-6">
			{/* 状态概览 */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
								<PlugIcon className="size-5 text-violet-600 dark:text-violet-400" />
							</div>
							<div>
								<CardTitle className="text-base">OpenClaw 接入</CardTitle>
								<CardDescription>
									让本地 AI Agent 通过 MCP 协议操作 Flowmail
								</CardDescription>
							</div>
						</div>
						<Badge
							status="info"
							className="h-6 rounded-md px-2 text-xs"
						>
							可用
						</Badge>
					</div>
				</CardHeader>
			</Card>

			{/* 工作原理 */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm flex items-center gap-2">
						<BookOpenIcon className="size-4" />
						工作原理
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<p className="text-sm text-muted-foreground leading-relaxed">
							OpenClaw 是一个开源的本地 AI Agent 运行时，拥有 3,200+ Skills。
							当你配置 Flowmail 作为 MCP Server 后，本地 Agent 可以：
						</p>
						<ul className="space-y-2 text-sm">
							<li className="flex items-start gap-2">
								<ShieldCheckIcon className="size-4 mt-0.5 shrink-0 text-emerald-500" />
								<span>读取和操作你的邮件事项（审批、汇报、风险分析）</span>
							</li>
							<li className="flex items-start gap-2">
								<ShieldCheckIcon className="size-4 mt-0.5 shrink-0 text-emerald-500" />
								<span>跨系统协同：OpenClaw + 日历 + Slack + GitHub 自动联动</span>
							</li>
							<li className="flex items-start gap-2">
								<ShieldCheckIcon className="size-4 mt-0.5 shrink-0 text-emerald-500" />
								<span>操作结果自动回流到 Flowmail 时间线，标注来源</span>
							</li>
						</ul>

						<div className="rounded-lg bg-muted/40 border p-3">
							<p className="text-xs text-muted-foreground leading-relaxed">
								<strong className="text-foreground">数据流向：</strong>
								本地 Agent → MCP 调用 → Flowmail 后端执行 → 结果写入数据库 → 时间线更新（标注「via OpenClaw」）
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* MCP Endpoint */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">MCP Server 地址</CardTitle>
					<CardDescription>
						此地址用于所有 MCP 客户端（OpenClaw、Cursor、Claude Desktop 等）
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<div className="space-y-1.5">
							<Label className="text-xs">Endpoint URL</Label>
							<div className="flex items-center gap-2">
								<Input
									readOnly
									value={mcpEndpointUrl}
									className="font-mono text-xs"
								/>
								<Button
									variant="outline"
									size="icon"
									className="shrink-0"
									onClick={() => copyToClipboard(mcpEndpointUrl, "url")}
								>
									{copied === "url" ? (
										<CheckIcon className="size-4 text-emerald-500" />
									) : (
										<CopyIcon className="size-4" />
									)}
								</Button>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs">Organization ID</Label>
							<div className="flex items-center gap-2">
								<Input
									readOnly
									value={organizationId}
									className="font-mono text-xs"
								/>
								<Button
									variant="outline"
									size="icon"
									className="shrink-0"
									onClick={() => copyToClipboard(organizationId, "orgId")}
								>
									{copied === "orgId" ? (
										<CheckIcon className="size-4 text-emerald-500" />
									) : (
										<CopyIcon className="size-4" />
									)}
								</Button>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* 配置方式 */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">配置指南</CardTitle>
					<CardDescription>选择你的客户端，复制对应配置</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<ConfigBlock
							title="Cursor / Claude Desktop (.mcp.json)"
							code={mcpJsonConfig}
							copied={copied}
							onCopy={(text) => copyToClipboard(text, "mcp-json")}
							copyKey="mcp-json"
						/>
						<ConfigBlock
							title="OpenClaw Skill"
							code={openclawSkillConfig}
							copied={copied}
							onCopy={(text) => copyToClipboard(text, "openclaw")}
							copyKey="openclaw"
						/>
					</div>
				</CardContent>
			</Card>

			{/* 外部链接 */}
			<div className="flex items-center gap-3">
				<a
					href="https://openclaw.dev/docs"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					<ExternalLinkIcon className="size-3" />
					OpenClaw 文档
				</a>
				<a
					href="https://modelcontextprotocol.io"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					<ExternalLinkIcon className="size-3" />
					MCP 协议规范
				</a>
			</div>
		</div>
	);
}

function ConfigBlock({
	title,
	code,
	copied,
	onCopy,
	copyKey,
}: {
	title: string;
	code: string;
	copied: string | null;
	onCopy: (text: string) => void;
	copyKey: string;
}) {
	return (
		<div className="rounded-lg border overflow-hidden">
			<div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
				<span className="text-xs font-medium">{title}</span>
				<Button
					variant="ghost"
					size="sm"
					className="h-6 px-2 text-[10px]"
					onClick={() => onCopy(code)}
				>
					{copied === copyKey ? (
						<>
							<CheckIcon className="size-3 mr-1 text-emerald-500" />
							已复制
						</>
					) : (
						<>
							<CopyIcon className="size-3 mr-1" />
							复制
						</>
					)}
				</Button>
			</div>
			<pre className={cn(
				"p-3 text-xs font-mono leading-relaxed overflow-x-auto",
				"bg-background text-foreground/80",
			)}>
				{code}
			</pre>
		</div>
	);
}
