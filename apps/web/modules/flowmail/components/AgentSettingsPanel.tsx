"use client";

import { cn } from "@repo/ui";
import {
	BotIcon,
	CodeIcon,
	CopyIcon,
	CheckIcon,
	PlugIcon,
	ShieldIcon,
} from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { useState } from "react";

interface AgentSettingsPanelProps {
	organizationId: string;
}

export function AgentSettingsPanel(_props: AgentSettingsPanelProps) {
	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-base font-semibold">Agent 接入</h3>
				<p className="text-sm text-muted-foreground mt-1">
					Flowmail 支持通过 MCP 协议接入各类 AI Agent，实现跨系统自动协同。
				</p>
			</div>

			{/* MCP Endpoint */}
			<div className="rounded-lg border p-4 space-y-3">
				<div className="flex items-center gap-2">
					<PlugIcon className="size-4 text-blue-500" />
					<h4 className="text-sm font-medium">MCP Server 端点</h4>
				</div>
				<p className="text-xs text-muted-foreground">
					任何支持 MCP 协议的 Agent（Claude Desktop、Cursor、GPT 等）都可以通过此端点接入 Flowmail。
				</p>
				<CopyableCodeBlock
					label="SSE 端点"
					value={`${typeof window !== "undefined" ? window.location.origin : ""}/mcp/sse`}
				/>
				<CopyableCodeBlock
					label="Streamable HTTP 端点"
					value={`${typeof window !== "undefined" ? window.location.origin : ""}/mcp/mcp`}
				/>
			</div>

			{/* .mcp.json 示例 */}
			<div className="rounded-lg border p-4 space-y-3">
				<div className="flex items-center gap-2">
					<CodeIcon className="size-4 text-emerald-500" />
					<h4 className="text-sm font-medium">本地配置示例</h4>
				</div>
				<p className="text-xs text-muted-foreground">
					在项目根目录创建 <code className="text-xs bg-muted px-1 py-0.5 rounded">.mcp.json</code>，Claude Desktop 和 Cursor 会自动识别。
				</p>
				<CopyableCodeBlock
					label=".mcp.json"
					value={JSON.stringify(
						{
							mcpServers: {
								flowmail: {
									url: `${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/mcp/sse`,
								},
							},
						},
						null,
						2,
					)}
					multiline
				/>
			</div>

			{/* 可用 Tools */}
			<div className="rounded-lg border p-4 space-y-3">
				<div className="flex items-center gap-2">
					<BotIcon className="size-4 text-violet-500" />
					<h4 className="text-sm font-medium">可用能力</h4>
				</div>
				<div className="grid gap-2">
					{TOOLS.map((tool) => (
						<div
							key={tool.name}
							className="flex items-start gap-2.5 rounded-md bg-muted/30 px-3 py-2"
						>
							<div className={cn("size-1.5 rounded-full mt-1.5 shrink-0", tool.color)} />
							<div className="min-w-0">
								<p className="text-xs font-medium">{tool.name}</p>
								<p className="text-[11px] text-muted-foreground">{tool.description}</p>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Security note */}
			<div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
				<div className="flex items-center gap-2 mb-1">
					<ShieldIcon className="size-4 text-amber-500" />
					<h4 className="text-sm font-medium">安全说明</h4>
				</div>
				<p className="text-xs text-muted-foreground">
					MCP 端点需要有效的认证 Session。Agent 在操作前会请求用户确认（人在回路），不会自动执行敏感操作。
				</p>
			</div>
		</div>
	);
}

function CopyableCodeBlock({
	label,
	value,
	multiline,
}: {
	label: string;
	value: string;
	multiline?: boolean;
}) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(value);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div>
			<div className="flex items-center justify-between mb-1">
				<span className="text-[11px] text-muted-foreground">{label}</span>
				<Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1" onClick={handleCopy}>
					{copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
					{copied ? "已复制" : "复制"}
				</Button>
			</div>
			<pre
				className={cn(
					"rounded-md bg-muted px-3 py-2 text-xs font-mono text-foreground/80 overflow-x-auto",
					multiline ? "whitespace-pre" : "whitespace-nowrap truncate",
				)}
			>
				{value}
			</pre>
		</div>
	);
}

const TOOLS = [
	{ name: "邮件管理", description: "读取、搜索、分类邮件，读取附件内容", color: "bg-blue-500" },
	{ name: "事项操作", description: "创建、更新事项，审批/拒绝，状态流转", color: "bg-emerald-500" },
	{ name: "AI 分析", description: "邮件分类、字段提取、线程总结、风险预测", color: "bg-violet-500" },
	{ name: "回复起草", description: "AI 辅助起草邮件回复，学习用户写作风格", color: "bg-amber-500" },
	{ name: "结构化记忆", description: "记住联系人画像、项目背景、用户偏好、决策记录", color: "bg-rose-500" },
	{ name: "代码执行", description: "JavaScript / Python 沙盒执行，数据处理和分析", color: "bg-cyan-500" },
];
