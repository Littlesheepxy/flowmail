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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
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
	ArrowLeftIcon,
	ExternalLinkIcon,
	GlobeIcon,
	KeyIcon,
	Loader2Icon,
	MailIcon,
	PlusIcon,
	RefreshCwIcon,
	ShieldCheckIcon,
	TrashIcon,
} from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useState } from "react";
import { usePageGuide } from "../hooks/use-page-guide";

type AuthMethod = "oauth" | "imap";

interface ProviderDef {
	id: string;
	name: string;
	icon: string;
	method: AuthMethod;
	description: string;
	oauthUrl?: string;
	scopes?: string;
}

const PROVIDERS: ProviderDef[] = [
	{
		id: "gmail",
		name: "Gmail",
		icon: "/icons/integrations/gmail.svg",
		method: "oauth",
		description: "通过 Google OAuth 安全授权",
		oauthUrl: "https://accounts.google.com/o/oauth2/v2/auth",
		scopes: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
	},
	{
		id: "feishu",
		name: "飞书邮箱",
		icon: "/icons/integrations/feishu.svg",
		method: "oauth",
		description: "通过飞书开放平台 OAuth 授权",
		oauthUrl: "https://accounts.feishu.cn/open-apis/authen/v1/authorize",
	},
	{
		id: "dingtalk",
		name: "钉钉邮箱",
		icon: "/icons/integrations/dingtalk.svg",
		method: "oauth",
		description: "通过钉钉开放平台 OAuth 授权",
		oauthUrl: "https://login.dingtalk.com/oauth2/auth",
		scopes: "openid",
	},
	{
		id: "wecom",
		name: "企微邮箱",
		icon: "/icons/integrations/wecom.png",
		method: "oauth",
		description: "通过企业微信 OAuth 授权",
		oauthUrl: "https://open.weixin.qq.com/connect/oauth2/authorize",
	},
	{
		id: "imap",
		name: "个人邮箱",
		icon: "",
		method: "imap",
		description: "通用 IMAP 连接（QQ、163、Outlook 等）",
	},
];

const WELL_KNOWN_IMAP: Record<string, { host: string; port: number }> = {
	"qq.com": { host: "imap.qq.com", port: 993 },
	"163.com": { host: "imap.163.com", port: 993 },
	"126.com": { host: "imap.126.com", port: 993 },
	"outlook.com": { host: "outlook.office365.com", port: 993 },
	"hotmail.com": { host: "outlook.office365.com", port: 993 },
	"yahoo.com": { host: "imap.mail.yahoo.com", port: 993 },
	"icloud.com": { host: "imap.mail.me.com", port: 993 },
};

export function EmailConnectionsList() {
	const { activeOrganization } = useActiveOrganization();
	const queryClient = useQueryClient();
	const params = useParams();
	const organizationSlug = params.organizationSlug as string;

	usePageGuide("connectEmail", [
		{
			element: '[data-guide="connect-email-btn"]',
			title: "第 1 步：点击「连接邮箱」",
			description:
				"点击此按钮开始连接。弹出的对话框中会列出 Gmail、飞书、钉钉、企微以及通用 IMAP（QQ邮箱、163等）多种选项。选择你的邮箱类型即可开始授权。\n\n连接成功后，Flowmail 会自动同步你的邮件并用 AI 进行分析。",
			side: "bottom",
		},
	]);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedProvider, setSelectedProvider] = useState<ProviderDef | null>(null);
	const [passwordDialogConn, setPasswordDialogConn] = useState<{ id: string; email: string } | null>(null);
	const [newImapPassword, setNewImapPassword] = useState("");

	const { data, isLoading } = useQuery(
		orpc.emailConnections.list.queryOptions({
			input: { organizationId: activeOrganization?.id ?? "" },
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

	const updatePwMutation = useMutation(
		orpc.emailConnections.updateImapPassword.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.emailConnections.list.key(),
				});
				setPasswordDialogConn(null);
				setNewImapPassword("");
			},
		}),
	);

	const syncMutation = useMutation(
		orpc.emailConnections.sync.mutationOptions({
			onSuccess: (result) => {
				queryClient.invalidateQueries({
					queryKey: orpc.emailConnections.list.key(),
				});
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.list.key(),
				});
				alert(
					`同步完成：获取 ${result.fetched} 封邮件，处理 ${result.processed} 封${result.errors ? `，${result.errors} 封失败` : ""}`,
				);
			},
			onError: (err) => {
				alert(`同步失败：${err.message}`);
			},
		}),
	);

	const connections = data ?? [];

	const providerLabel = (provider: string) => {
		const found = PROVIDERS.find((p) => p.id === provider);
		return found?.name ?? provider;
	};

	function handleClose() {
		setDialogOpen(false);
		setSelectedProvider(null);
	}

	return (
		<div data-module="connections" className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-lg">邮箱连接</h3>
					<p className="text-sm text-muted-foreground">
						Flowmail 监听这些邮箱并自动提取业务事项。
					</p>
				</div>
				<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
					<DialogTrigger asChild>
						<Button data-guide="connect-email-btn" onClick={() => setSelectedProvider(null)}>
							<PlusIcon className="mr-2 size-4" />
							连接邮箱
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-[480px]">
						{!selectedProvider ? (
							<ProviderPicker onSelect={setSelectedProvider} />
						) : selectedProvider.id === "gmail" ? (
							<GmailOAuthForm
								organizationId={activeOrganization?.id ?? ""}
								organizationSlug={organizationSlug}
								onBack={() => setSelectedProvider(null)}
							/>
						) : selectedProvider.method === "oauth" ? (
							<PlatformOAuthForm
								provider={selectedProvider}
								organizationId={activeOrganization?.id ?? ""}
								organizationSlug={organizationSlug}
								onBack={() => setSelectedProvider(null)}
							/>
						) : (
							<ImapConnectForm
								organizationId={activeOrganization?.id ?? ""}
								onBack={() => setSelectedProvider(null)}
								onSuccess={() => {
									handleClose();
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
											点击上方「连接邮箱」开始自动处理邮件。
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
											<span className="font-medium text-foreground">
												{conn.email}
											</span>
										</div>
									</TableCell>
									<TableCell>
										<Badge status="info">{providerLabel(conn.provider)}</Badge>
									</TableCell>
									<TableCell>
										{conn.isActive && !["gmail", "feishu"].includes(conn.provider) && !conn.hasImapPassword ? (
											<Badge status="warning">需配置 IMAP 密码</Badge>
										) : (
											<Badge status={conn.isActive ? "success" : "error"}>
												{conn.isActive ? "已连接" : "已断开"}
											</Badge>
										)}
									</TableCell>
									<TableCell className="text-sm text-muted-foreground">
										{conn.lastSyncAt
											? new Date(conn.lastSyncAt).toLocaleString()
											: "从未同步"}
									</TableCell>
									<TableCell>
										<div className="flex justify-end gap-1">
											{!["gmail", "feishu"].includes(conn.provider) && !conn.hasImapPassword && (
												<Button
													size="icon"
													variant="ghost"
													title="设置 IMAP 密码"
													onClick={() => {
														setPasswordDialogConn({ id: conn.id, email: conn.email });
														setNewImapPassword("");
													}}
												>
													<KeyIcon className="size-4 text-amber-500" />
												</Button>
											)}
											<Button
												size="icon"
												variant="ghost"
												title="同步邮件"
												disabled={syncMutation.isPending}
												onClick={() =>
													syncMutation.mutate({
														connectionId: conn.id,
													})
												}
											>
												{syncMutation.isPending ? (
													<Loader2Icon className="size-4 animate-spin" />
												) : (
													<RefreshCwIcon className="size-4" />
												)}
											</Button>
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

			<Dialog
				open={!!passwordDialogConn}
				onOpenChange={(open) => {
					if (!open) {
						setPasswordDialogConn(null);
					}
				}}
			>
				<DialogContent className="sm:max-w-[400px]">
					<DialogHeader>
						<DialogTitle>设置 IMAP 密码</DialogTitle>
						<DialogDescription>
							为 {passwordDialogConn?.email} 设置 IMAP 专用密码以启用邮件同步。
						</DialogDescription>
					</DialogHeader>
					<form
						className="space-y-4 mt-2"
						onSubmit={(e) => {
							e.preventDefault();
							if (passwordDialogConn && newImapPassword.trim()) {
								updatePwMutation.mutate({
									connectionId: passwordDialogConn.id,
									imapPassword: newImapPassword.trim(),
								});
							}
						}}
					>
						<div className="space-y-2">
							<Label>IMAP 专用密码</Label>
							<Input
								type="password"
								placeholder="在邮箱设置中生成的应用专用密码"
								value={newImapPassword}
								onChange={(e) => setNewImapPassword(e.target.value)}
								required
								autoFocus
							/>
							<p className="text-xs text-muted-foreground">
								请在飞书/钉钉/企微邮箱设置中开启 IMAP 服务并生成专用密码。
							</p>
						</div>
						<Button
							type="submit"
							className="w-full"
							disabled={!newImapPassword.trim() || updatePwMutation.isPending}
						>
							{updatePwMutation.isPending ? "保存中..." : "保存并启用同步"}
						</Button>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ProviderPicker({
	onSelect,
}: {
	onSelect: (p: ProviderDef) => void;
}) {
	const oauthProviders = PROVIDERS.filter((p) => p.method === "oauth");
	const imapProvider = PROVIDERS.find((p) => p.id === "imap");

	return (
		<>
			<DialogHeader>
				<DialogTitle>连接邮箱</DialogTitle>
				<DialogDescription>选择你的邮箱服务，通过 OAuth 安全授权连接。</DialogDescription>
			</DialogHeader>

			<div className="grid grid-cols-2 gap-3 mt-2">
				{oauthProviders.map((p) => (
					<button
						key={p.id}
						type="button"
						onClick={() => onSelect(p)}
						className="flex flex-col items-center gap-2.5 rounded-lg border p-4 transition-colors hover:bg-muted/50 hover:border-primary/30"
					>
						<Image src={p.icon} alt={p.name} width={36} height={36} />
						<span className="text-sm font-medium text-foreground">{p.name}</span>
						<span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
							<ShieldCheckIcon className="size-3" />
							OAuth
						</span>
					</button>
				))}
			</div>

			{imapProvider && (
				<>
					<div className="relative my-2">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t" />
						</div>
						<div className="relative flex justify-center text-xs">
							<span className="bg-background px-2 text-muted-foreground">
								或
							</span>
						</div>
					</div>
					<button
						type="button"
						onClick={() => onSelect(imapProvider)}
						className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 hover:border-primary/30 w-full text-left"
					>
						<div className="flex size-9 items-center justify-center rounded-full bg-muted">
							<GlobeIcon className="size-4 text-muted-foreground" />
						</div>
						<div>
							<p className="text-sm font-medium text-foreground">个人邮箱 / 通用 IMAP</p>
							<p className="text-xs text-muted-foreground">
								QQ 邮箱、163、Outlook、iCloud 等
							</p>
						</div>
						<KeyIcon className="size-4 text-muted-foreground/50 ml-auto" />
					</button>
				</>
			)}
		</>
	);
}

function GmailOAuthForm({
	organizationId,
	organizationSlug,
	onBack,
}: {
	organizationId: string;
	organizationSlug: string;
	onBack: () => void;
}) {
	function handleConnect() {
		const clientId = process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID;
		if (!clientId) {
			alert("Gmail OAuth 尚未配置 (NEXT_PUBLIC_GMAIL_CLIENT_ID)");
			return;
		}

		const redirectUri = `${window.location.origin}/app/${organizationSlug}/connections/callback`;

		sessionStorage.setItem(
			"flowmail_oauth_state",
			JSON.stringify({ provider: "gmail", organizationId }),
		);

		const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
		authUrl.searchParams.set("client_id", clientId);
		authUrl.searchParams.set("redirect_uri", redirectUri);
		authUrl.searchParams.set("response_type", "code");
		authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send");
		authUrl.searchParams.set("access_type", "offline");
		authUrl.searchParams.set("prompt", "consent");
		authUrl.searchParams.set("state", organizationId);

		window.location.href = authUrl.toString();
	}

	return (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
						<ArrowLeftIcon className="size-4" />
					</button>
					<DialogTitle>连接 Gmail</DialogTitle>
				</div>
				<DialogDescription>
					通过 Google OAuth 安全授权，Flowmail 仅获取邮件只读权限。
				</DialogDescription>
			</DialogHeader>

			<div className="flex flex-col items-center gap-4 py-4">
				<Image src="/icons/integrations/gmail.svg" alt="Gmail" width={48} height={48} />
				<div className="text-center space-y-1">
					<p className="text-sm text-muted-foreground">
						点击下方按钮将跳转到 Google 登录页面
					</p>
					<p className="text-xs text-muted-foreground/60">
						授权后会自动返回 Flowmail
					</p>
				</div>
				<Button onClick={handleConnect} className="w-full gap-2">
					<ExternalLinkIcon className="size-4" />
					前往 Google 授权
				</Button>
			</div>
		</>
	);
}

function PlatformOAuthForm({
	provider,
	organizationId,
	organizationSlug,
	onBack,
}: {
	provider: ProviderDef;
	organizationId: string;
	organizationSlug: string;
	onBack: () => void;
}) {
	const [appId, setAppId] = useState("");
	const [appSecret, setAppSecret] = useState("");
	const [imapPassword, setImapPassword] = useState("");

	function handleConnect() {
		if (!appId.trim() || !appSecret.trim()) {
			return;
		}

		const redirectUri = `${window.location.origin}/app/${organizationSlug}/connections/callback`;

		sessionStorage.setItem(
			"flowmail_oauth_state",
			JSON.stringify({
				provider: provider.id,
				organizationId,
				appId: appId.trim(),
				appSecret: appSecret.trim(),
				...(imapPassword.trim() ? { imapPassword: imapPassword.trim() } : {}),
			}),
		);

		let authUrl: URL;

		if (provider.id === "feishu") {
			authUrl = new URL("https://accounts.feishu.cn/open-apis/authen/v1/authorize");
			authUrl.searchParams.set("client_id", appId.trim());
			authUrl.searchParams.set("redirect_uri", redirectUri);
			authUrl.searchParams.set("response_type", "code");
			authUrl.searchParams.set("scope", "contact:user.email:readonly mail:user_mailbox.message:readonly mail:user_mailbox.message.subject:read mail:user_mailbox.message.address:read mail:user_mailbox.message.body:read");
			authUrl.searchParams.set("state", organizationId);
		} else if (provider.id === "dingtalk") {
			authUrl = new URL("https://login.dingtalk.com/oauth2/auth");
			authUrl.searchParams.set("client_id", appId.trim());
			authUrl.searchParams.set("redirect_uri", redirectUri);
			authUrl.searchParams.set("response_type", "code");
			authUrl.searchParams.set("scope", "openid");
			authUrl.searchParams.set("prompt", "consent");
			authUrl.searchParams.set("state", organizationId);
		} else if (provider.id === "wecom") {
			authUrl = new URL("https://open.weixin.qq.com/connect/oauth2/authorize");
			authUrl.searchParams.set("appid", appId.trim());
			authUrl.searchParams.set("redirect_uri", redirectUri);
			authUrl.searchParams.set("response_type", "code");
			authUrl.searchParams.set("scope", "snsapi_privateinfo");
			authUrl.searchParams.set("state", organizationId);
			authUrl.hash = "wechat_redirect";
		} else {
			return;
		}

		window.location.href = authUrl.toString();
	}

	const platformGuide: Record<string, { docUrl: string; idLabel: string; secretLabel: string }> = {
		feishu: {
			docUrl: "https://open.feishu.cn/app",
			idLabel: "App ID",
			secretLabel: "App Secret",
		},
		dingtalk: {
			docUrl: "https://open-dev.dingtalk.com/",
			idLabel: "Client ID (AppKey)",
			secretLabel: "Client Secret (AppSecret)",
		},
		wecom: {
			docUrl: "https://work.weixin.qq.com/wework_admin/frame#apps",
			idLabel: "Corp ID",
			secretLabel: "Secret",
		},
	};

	const guide = platformGuide[provider.id];

	return (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
						<ArrowLeftIcon className="size-4" />
					</button>
					<DialogTitle>连接 {provider.name}</DialogTitle>
				</div>
				<DialogDescription>
					填写你在开放平台创建的应用凭据，然后进行 OAuth 授权。
				</DialogDescription>
			</DialogHeader>

			<form
				className="space-y-4 mt-2"
				onSubmit={(e) => {
					e.preventDefault();
					handleConnect();
				}}
			>
				<div className="flex items-center gap-3 rounded-lg bg-muted/50 border p-3">
					<Image src={provider.icon} alt={provider.name} width={28} height={28} />
					<div className="flex-1">
						<p className="text-sm font-medium text-foreground">{provider.name}</p>
						<p className="text-xs text-muted-foreground">{provider.description}</p>
					</div>
				</div>

				<div className="space-y-2">
					<Label>{guide?.idLabel ?? "App ID"}</Label>
					<Input
						placeholder="输入 App ID"
						value={appId}
						onChange={(e) => setAppId(e.target.value)}
						required
					/>
				</div>
				<div className="space-y-2">
					<Label>{guide?.secretLabel ?? "App Secret"}</Label>
					<Input
						type="password"
						placeholder="输入 App Secret"
						value={appSecret}
						onChange={(e) => setAppSecret(e.target.value)}
						required
					/>
				</div>

				{provider.id !== "feishu" && (
					<div className="space-y-2">
						<Label>
							IMAP 专用密码
							<span className="text-muted-foreground font-normal ml-1">(同步邮件必填)</span>
						</Label>
						<Input
							type="password"
							placeholder="在邮箱设置中生成的应用专用密码"
							value={imapPassword}
							onChange={(e) => setImapPassword(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							OAuth 仅用于身份验证，邮件同步需要 IMAP 密码。请在邮箱设置中开启 IMAP 并生成专用密码。
						</p>
					</div>
				)}

				{guide?.docUrl && (
					<p className="text-xs text-muted-foreground">
						没有应用凭据？
						<a
							href={guide.docUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline ml-1"
						>
							前往开放平台创建 →
						</a>
					</p>
				)}

				<Button type="submit" className="w-full gap-2" disabled={!appId.trim() || !appSecret.trim()}>
					<ExternalLinkIcon className="size-4" />
					前往授权
				</Button>
			</form>
		</>
	);
}

function ImapConnectForm({
	organizationId,
	onBack,
	onSuccess,
}: {
	organizationId: string;
	onBack: () => void;
	onSuccess: () => void;
}) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [imapHost, setImapHost] = useState("");
	const [imapPort, setImapPort] = useState("");
	const [maxSyncCount, setMaxSyncCount] = useState("500");

	const connectMutation = useMutation(
		orpc.emailConnections.connectImap.mutationOptions({ onSuccess }),
	);

	function guessImapSettings(emailAddr: string) {
		const domain = emailAddr.split("@")[1]?.toLowerCase();
		if (domain && WELL_KNOWN_IMAP[domain]) {
			const settings = WELL_KNOWN_IMAP[domain];
			if (!imapHost) {
				setImapHost(settings.host);
			}
			if (!imapPort) {
				setImapPort(String(settings.port));
			}
		}
	}

	return (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
						<ArrowLeftIcon className="size-4" />
					</button>
					<DialogTitle>连接个人邮箱</DialogTitle>
				</div>
				<DialogDescription>
					通过 IMAP 协议连接，需要邮箱地址和应用专用密码。
				</DialogDescription>
			</DialogHeader>

			<form
				className="space-y-4 mt-2"
				onSubmit={(e) => {
					e.preventDefault();
					connectMutation.mutate({
						organizationId,
						provider: "imap",
						email,
						password,
						...(imapHost ? { imapHost } : {}),
						...(imapPort ? { imapPort: Number.parseInt(imapPort) } : {}),
						maxSyncCount: Number.parseInt(maxSyncCount),
					});
				}}
			>
				<div className="space-y-2">
					<Label>邮箱地址</Label>
					<Input
						type="email"
						placeholder="you@example.com"
						value={email}
						onChange={(e) => {
							setEmail(e.target.value);
							guessImapSettings(e.target.value);
						}}
						required
					/>
				</div>
				<div className="space-y-2">
					<Label>应用专用密码</Label>
					<Input
						type="password"
						placeholder="在邮箱设置中生成的专用密码"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
				</div>
				<div className="space-y-2">
					<Label>首次同步数量</Label>
					<Select value={maxSyncCount} onValueChange={setMaxSyncCount}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="100">最近 100 封</SelectItem>
							<SelectItem value="500">最近 500 封（推荐）</SelectItem>
							<SelectItem value="1000">最近 1000 封</SelectItem>
							<SelectItem value="5000">最近 5000 封</SelectItem>
							<SelectItem value="10000">全部（最多 10000 封）</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-xs text-muted-foreground">
						邮件总数低于此值时会全部同步。
					</p>
				</div>

				<div className="grid grid-cols-3 gap-3">
					<div className="col-span-2 space-y-2">
						<Label>IMAP 服务器</Label>
						<Input
							placeholder="imap.example.com"
							value={imapHost}
							onChange={(e) => setImapHost(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label>端口</Label>
						<Input
							placeholder="993"
							value={imapPort}
							onChange={(e) => setImapPort(e.target.value)}
						/>
					</div>
				</div>

				<p className="text-xs text-muted-foreground">
					IMAP 服务器和端口会根据邮箱域名自动填充（支持 QQ、163、Outlook 等）。
				</p>

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
		</>
	);
}
