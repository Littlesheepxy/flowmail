"use client";

import { cn, Spinner } from "@repo/ui";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	BookOpenIcon,
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	KeyIcon,
	PlugIcon,
	PlusIcon,
	ShieldCheckIcon,
	TrashIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

interface OpenClawSettingsProps {
	organizationId: string;
	mcpEndpointUrl: string;
}

export function OpenClawSettings({
	organizationId,
	mcpEndpointUrl,
}: OpenClawSettingsProps) {
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
					headers: { Authorization: "Bearer <YOUR_API_TOKEN>" },
				},
			},
		},
		null,
		2,
	);

	const openclawConfig = JSON.stringify(
		{
			mcp: {
				servers: {
					flowmail: {
						url: mcpEndpointUrl,
						headers: { Authorization: "Bearer <YOUR_API_TOKEN>" },
					},
				},
			},
		},
		null,
		2,
	);

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
								<CardTitle className="text-base">
									Agent / MCP 接入
								</CardTitle>
								<CardDescription>
									让 AI Agent 通过 MCP 协议操作 Flowmail
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

			{/* API Token 管理 */}
			<TokenManager organizationId={organizationId} />

			{/* MCP Endpoint */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">MCP Server 地址</CardTitle>
					<CardDescription>
						此地址用于所有 MCP 客户端（OpenClaw、Cursor、Claude
						Desktop 等）
					</CardDescription>
				</CardHeader>
				<CardContent>
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
								onClick={() =>
									copyToClipboard(mcpEndpointUrl, "url")
								}
							>
								{copied === "url" ? (
									<CheckIcon className="size-4 text-emerald-500" />
								) : (
									<CopyIcon className="size-4" />
								)}
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* 配置指南 */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">配置指南</CardTitle>
					<CardDescription>
						选择你的客户端，复制对应配置
					</CardDescription>
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
							title="OpenClaw (openclaw.json)"
							code={openclawConfig}
							copied={copied}
							onCopy={(text) => copyToClipboard(text, "openclaw")}
							copyKey="openclaw"
						/>
					</div>
				</CardContent>
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
							配置 API Token 后，外部 Agent 可以通过 MCP 协议调用
							Flowmail 的全部能力：
						</p>
						<ul className="space-y-2 text-sm">
							<li className="flex items-start gap-2">
								<ShieldCheckIcon className="size-4 mt-0.5 shrink-0 text-emerald-500" />
								<span>
									读取和操作邮件事项（审批、汇报、风险分析）
								</span>
							</li>
							<li className="flex items-start gap-2">
								<ShieldCheckIcon className="size-4 mt-0.5 shrink-0 text-emerald-500" />
								<span>搜索邮件、查看时间线、执行审批动作</span>
							</li>
							<li className="flex items-start gap-2">
								<ShieldCheckIcon className="size-4 mt-0.5 shrink-0 text-emerald-500" />
								<span>
									跨系统协同：OpenClaw + 日历 + Slack + GitHub
									自动联动
								</span>
							</li>
						</ul>
					</div>
				</CardContent>
			</Card>

			{/* 外部链接 */}
			<div className="flex items-center gap-3">
				<a
					href="https://docs.openclaw.ai"
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

function TokenManager({ organizationId }: { organizationId: string }) {
	const queryClient = useQueryClient();
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [newTokenName, setNewTokenName] = useState("");
	const [createdToken, setCreatedToken] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const { data: tokens, isLoading } = useQuery(
		orpc.apiTokens.list.queryOptions({ input: { organizationId } }),
	);

	const createMutation = useMutation(
		orpc.apiTokens.create.mutationOptions({
			onSuccess: (data) => {
				setCreatedToken(data.token);
				setNewTokenName("");
				queryClient.invalidateQueries({
					queryKey: orpc.apiTokens.list.queryOptions({
						input: { organizationId },
					}).queryKey,
				});
			},
		}),
	);

	const revokeMutation = useMutation(
		orpc.apiTokens.revoke.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.apiTokens.list.queryOptions({
						input: { organizationId },
					}).queryKey,
				});
			},
		}),
	);

	function handleCreate() {
		if (!newTokenName.trim()) {
			return;
		}
		createMutation.mutate({
			organizationId,
			name: newTokenName.trim(),
		});
	}

	function handleCloseCreate() {
		setShowCreateDialog(false);
		setCreatedToken(null);
		setNewTokenName("");
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-sm flex items-center gap-2">
							<KeyIcon className="size-4" />
							API Tokens
						</CardTitle>
						<CardDescription>
							管理 MCP 访问令牌，用于 OpenClaw、Cursor 等 Agent
							接入
						</CardDescription>
					</div>
					<Dialog
						open={showCreateDialog}
						onOpenChange={(open) => {
							if (!open) {
								handleCloseCreate();
							} else {
								setShowCreateDialog(true);
							}
						}}
					>
						<DialogTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 gap-1.5"
							>
								<PlusIcon className="size-3.5" />
								创建 Token
							</Button>
						</DialogTrigger>
						<DialogContent>
							{createdToken ? (
								<>
									<DialogHeader>
										<DialogTitle>Token 已创建</DialogTitle>
										<DialogDescription>
											请立即复制保存，此令牌仅显示一次。
										</DialogDescription>
									</DialogHeader>
									<div className="space-y-3 mt-2">
										<div className="flex items-center gap-2 rounded-lg bg-muted/50 border p-3">
											<code className="flex-1 text-xs font-mono break-all select-all">
												{createdToken}
											</code>
											<Button
												variant="ghost"
												size="icon"
												className="shrink-0"
												onClick={() => {
													navigator.clipboard.writeText(
														createdToken,
													);
													setCopied(true);
													setTimeout(
														() => setCopied(false),
														2000,
													);
												}}
											>
												{copied ? (
													<CheckIcon className="size-4 text-emerald-500" />
												) : (
													<CopyIcon className="size-4" />
												)}
											</Button>
										</div>
										<div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
											<AlertTriangleIcon className="size-4 mt-0.5 shrink-0 text-amber-600" />
											<p className="text-xs text-amber-800 dark:text-amber-200">
												关闭此对话框后将无法再次查看完整令牌。请确保已安全保存。
											</p>
										</div>
										<Button
											className="w-full"
											onClick={handleCloseCreate}
										>
											我已保存，关闭
										</Button>
									</div>
								</>
							) : (
								<>
									<DialogHeader>
										<DialogTitle>
											创建 API Token
										</DialogTitle>
										<DialogDescription>
											为 Agent 创建一个访问令牌，用于调用
											Flowmail MCP 接口。
										</DialogDescription>
									</DialogHeader>
									<form
										className="space-y-4 mt-2"
										onSubmit={(e) => {
											e.preventDefault();
											handleCreate();
										}}
									>
										<div className="space-y-2">
											<Label>名称</Label>
											<Input
												placeholder="例如：OpenClaw Production"
												value={newTokenName}
												onChange={(e) =>
													setNewTokenName(
														e.target.value,
													)
												}
												required
											/>
											<p className="text-xs text-muted-foreground">
												取一个有辨识度的名字，方便管理多个
												Token。
											</p>
										</div>
										{createMutation.error && (
											<p className="text-sm text-destructive">
												{createMutation.error.message}
											</p>
										)}
										<Button
											type="submit"
											className="w-full"
											disabled={createMutation.isPending}
										>
											{createMutation.isPending && (
												<Spinner className="mr-2 size-4" />
											)}
											创建
										</Button>
									</form>
								</>
							)}
						</DialogContent>
					</Dialog>
				</div>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="flex justify-center py-6">
						<Spinner className="size-5" />
					</div>
				) : !tokens || tokens.length === 0 ? (
					<div className="text-center py-6">
						<KeyIcon className="size-8 mx-auto mb-2 text-muted-foreground/40" />
						<p className="text-sm text-muted-foreground">
							还没有 API Token，创建一个来开始接入。
						</p>
					</div>
				) : (
					<div className="space-y-2">
						{tokens.map((token) => (
							<div
								key={token.id}
								className={cn(
									"flex items-center justify-between rounded-lg border p-3 transition-colors",
									!token.isActive && "opacity-50",
								)}
							>
								<div className="space-y-1 min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium truncate">
											{token.name}
										</span>
										{!token.isActive && (
											<Badge
												status="warning"
												className="text-[10px] h-5 px-1.5"
											>
												已停用
											</Badge>
										)}
									</div>
									<div className="flex items-center gap-3 text-xs text-muted-foreground">
										<code className="font-mono">
											{token.prefix}
										</code>
										{token.lastUsedAt && (
											<span>
												最近使用:{" "}
												{new Date(
													token.lastUsedAt,
												).toLocaleDateString("zh-CN")}
											</span>
										)}
										<span>
											创建于:{" "}
											{new Date(
												token.createdAt,
											).toLocaleDateString("zh-CN")}
										</span>
									</div>
								</div>
								{token.isActive && (
									<Button
										variant="ghost"
										size="icon"
										className="shrink-0 text-muted-foreground hover:text-destructive"
										onClick={() =>
											revokeMutation.mutate({
												tokenId: token.id,
											})
										}
										disabled={revokeMutation.isPending}
									>
										<TrashIcon className="size-4" />
									</Button>
								)}
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
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
			<pre
				className={cn(
					"p-3 text-xs font-mono leading-relaxed overflow-x-auto",
					"bg-background text-foreground/80",
				)}
			>
				{code}
			</pre>
		</div>
	);
}
