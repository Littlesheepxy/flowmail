"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
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
import { Spinner } from "@repo/ui";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	MailIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

const PROVIDERS = [
	{
		id: "gmail" as const,
		name: "Gmail",
		icon: "/icons/integrations/gmail.svg",
		type: "oauth" as const,
	},
	{
		id: "feishu" as const,
		name: "飞书邮箱",
		icon: "/icons/integrations/feishu.svg",
		type: "imap" as const,
	},
	{
		id: "dingtalk" as const,
		name: "钉钉邮箱",
		icon: "/icons/integrations/dingtalk.svg",
		type: "imap" as const,
	},
	{
		id: "wecom" as const,
		name: "企微邮箱",
		icon: "/icons/integrations/wecom.png",
		type: "imap" as const,
	},
];

function GmailConnectButton({ organizationId }: { organizationId: string }) {
	const handleGmailConnect = () => {
		const clientId = process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID;
		if (!clientId) {
			alert("Gmail OAuth not configured");
			return;
		}

		const redirectUri = `${window.location.origin}/app/settings/email-connections/callback`;
		const scope = "https://www.googleapis.com/auth/gmail.readonly";
		const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
		authUrl.searchParams.set("client_id", clientId);
		authUrl.searchParams.set("redirect_uri", redirectUri);
		authUrl.searchParams.set("response_type", "code");
		authUrl.searchParams.set("scope", scope);
		authUrl.searchParams.set("access_type", "offline");
		authUrl.searchParams.set("prompt", "consent");
		authUrl.searchParams.set("state", organizationId);

		window.location.href = authUrl.toString();
	};

	return (
		<Button variant="outline" className="h-auto flex-col gap-2 p-4" onClick={handleGmailConnect}>
			<Image src="/icons/integrations/gmail.svg" alt="Gmail" width={32} height={32} />
			<span className="text-sm font-medium">Gmail</span>
		</Button>
	);
}

function ImapConnectForm({
	provider,
	organizationId,
	onSuccess,
}: {
	provider: (typeof PROVIDERS)[number];
	organizationId: string;
	onSuccess: () => void;
}) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [imapHost, setImapHost] = useState("");
	const [imapPort, setImapPort] = useState("");

	const connectMutation = useMutation(
		orpc.emailConnections.connectImap.mutationOptions({
			onSuccess,
		}),
	);

	const showAdvanced = provider.id === "imap";

	return (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault();
				connectMutation.mutate({
					organizationId,
					provider: provider.id as "feishu" | "dingtalk" | "wecom" | "imap",
					email,
					password,
					...(imapHost ? { imapHost } : {}),
					...(imapPort ? { imapPort: Number.parseInt(imapPort) } : {}),
				});
			}}
		>
			<div className="space-y-2">
				<Label>邮箱地址</Label>
				<Input
					type="email"
					placeholder="you@example.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label>密码 / 应用专用密码</Label>
				<Input
					type="password"
					placeholder="应用专用密码"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>
			</div>

			{showAdvanced && (
				<>
					<div className="space-y-2">
						<Label>IMAP 服务器</Label>
						<Input
							placeholder="imap.example.com"
							value={imapHost}
							onChange={(e) => setImapHost(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label>IMAP 端口</Label>
						<Input
							placeholder="993"
							value={imapPort}
							onChange={(e) => setImapPort(e.target.value)}
						/>
					</div>
				</>
			)}

			{connectMutation.error && (
				<p className="text-sm text-destructive">
					{connectMutation.error.message}
				</p>
			)}

			<Button type="submit" className="w-full" disabled={connectMutation.isPending}>
				{connectMutation.isPending && <Spinner className="mr-2 size-4" />}
				测试并连接
			</Button>
		</form>
	);
}

export function EmailConnectionsList() {
	const { activeOrganization } = useActiveOrganization();
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedProvider, setSelectedProvider] = useState<
		(typeof PROVIDERS)[number] | null
	>(null);

	const { data, isLoading } = useQuery(
		orpc.emailConnections.list.queryOptions({
			input: {
				organizationId: activeOrganization?.id ?? "",
			},
		}),
	);

	const disconnectMutation = useMutation(
		orpc.emailConnections.disconnect.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.emailConnections.list.key(),
				});
			},
		}),
	);

	const connections = data ?? [];

	const providerLabel = (provider: string) => {
		const found = PROVIDERS.find((p) => p.id === provider);
		return found?.name ?? provider;
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-lg">邮箱连接</h3>
					<p className="text-sm text-muted-foreground">
						Flowmail 监听这些邮箱并自动提取业务事项。
					</p>
				</div>
				<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
					<DialogTrigger asChild>
						<Button onClick={() => setSelectedProvider(null)}>
							<PlusIcon className="mr-2 size-4" />
							连接邮箱
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{selectedProvider ? `连接 ${selectedProvider.name}` : "选择邮箱类型"}
							</DialogTitle>
							<DialogDescription>
								{selectedProvider
									? "请输入你的邮箱凭据。"
									: "选择你想连接的邮箱服务。"}
							</DialogDescription>
						</DialogHeader>

						{!selectedProvider ? (
							<div className="grid grid-cols-2 gap-3">
								<GmailConnectButton
									organizationId={activeOrganization?.id ?? ""}
								/>
								{PROVIDERS.filter((p) => p.type === "imap").map((p) => (
									<Button
										key={p.id}
										variant="outline"
										className="h-auto flex-col gap-2 p-4"
										onClick={() => setSelectedProvider(p)}
									>
										<Image
											src={p.icon}
											alt={p.name}
											width={32}
											height={32}
										/>
										<span className="text-sm font-medium">{p.name}</span>
									</Button>
								))}
							</div>
						) : (
							<ImapConnectForm
								provider={selectedProvider}
								organizationId={activeOrganization?.id ?? ""}
								onSuccess={() => {
									setDialogOpen(false);
									setSelectedProvider(null);
									queryClient.invalidateQueries({
										queryKey: orpc.emailConnections.list.key(),
									});
								}}
							/>
						)}
					</DialogContent>
				</Dialog>
			</div>

			<Card className="p-0">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>邮箱</TableHead>
							<TableHead>类型</TableHead>
							<TableHead>状态</TableHead>
							<TableHead>最后同步</TableHead>
							<TableHead className="text-right">操作</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={5} className="h-32 text-center">
									<div className="flex items-center justify-center gap-2">
										<Spinner className="size-4 text-primary" />
										加载中...
									</div>
								</TableCell>
							</TableRow>
						) : connections.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={5}
									className="h-32 text-center text-muted-foreground"
								>
									<div className="flex flex-col items-center gap-2">
										<MailIcon className="size-8 text-muted-foreground/50" />
										<p>暂无已连接的邮箱</p>
										<p className="text-xs">
											连接 Gmail、飞书、钉钉或企微邮箱开始自动处理邮件。
										</p>
									</div>
								</TableCell>
							</TableRow>
						) : (
							connections.map((conn) => (
								<TableRow key={conn.id}>
									<TableCell>
										<div className="flex items-center gap-2">
											<MailIcon className="size-4 text-muted-foreground" />
											<span className="font-medium">{conn.email}</span>
										</div>
									</TableCell>
									<TableCell>
										<Badge status="info">{providerLabel(conn.provider)}</Badge>
									</TableCell>
									<TableCell>
										<Badge status={conn.isActive ? "success" : "error"}>
											{conn.isActive ? "已连接" : "已断开"}
										</Badge>
									</TableCell>
									<TableCell className="text-sm text-muted-foreground">
										{conn.lastSyncAt
											? new Date(conn.lastSyncAt).toLocaleString()
											: "从未同步"}
									</TableCell>
									<TableCell>
										<div className="flex justify-end gap-1">
											<Button
												size="icon"
												variant="ghost"
												title="断开连接"
												disabled={disconnectMutation.isPending}
												onClick={() =>
													disconnectMutation.mutate({
														connectionId: conn.id,
													})
												}
											>
												<TrashIcon className="size-4" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</Card>
		</div>
	);
}
