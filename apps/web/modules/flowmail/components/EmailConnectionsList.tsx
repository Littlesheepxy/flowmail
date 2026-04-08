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
	ArrowRightIcon,
	CheckCircle2Icon as CheckCircleIcon,
	CopyIcon,
	ExternalLinkIcon,
	GlobeIcon,
	KeyIcon,
	Loader2Icon,
	MailIcon,
	PlusIcon,
	RefreshCwIcon,
	SendIcon,
	ShieldCheckIcon,
	SparklesIcon,
	TrashIcon,
	ZapIcon,
} from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useState } from "react";
import { usePageGuide } from "../hooks/use-page-guide";

type ConnectionMethod = "oauth-gmail" | "oauth-outlook" | "oauth-platform" | "imap" | "forward";
type DialogStep = "detect" | "gmail" | "outlook" | "platform-choice" | "platform" | "imap" | "forward";

interface DetectedRoute {
	method: ConnectionMethod;
	label: string;
	description: string;
	providerId: string;
	imapHost?: string;
	imapPort?: number;
}

interface PlatformDef {
	id: string;
	name: string;
	icon: string;
	docUrl: string;
	idLabel: string;
	secretLabel: string;
}

const PLATFORMS: Record<string, PlatformDef> = {
	feishu: {
		id: "feishu",
		name: "飞书邮箱",
		icon: "/icons/integrations/feishu.svg",
		docUrl: "https://open.feishu.cn/app",
		idLabel: "App ID",
		secretLabel: "App Secret",
	},
	dingtalk: {
		id: "dingtalk",
		name: "钉钉邮箱",
		icon: "/icons/integrations/dingtalk.svg",
		docUrl: "https://open-dev.dingtalk.com/",
		idLabel: "Client ID (AppKey)",
		secretLabel: "Client Secret (AppSecret)",
	},
	wecom: {
		id: "wecom",
		name: "企微邮箱",
		icon: "/icons/integrations/wecom.png",
		docUrl: "https://work.weixin.qq.com/wework_admin/frame#apps",
		idLabel: "Corp ID",
		secretLabel: "Secret",
	},
};

function apiResultToRoute(result: {
	provider: string;
	method: string;
	label: string;
	imapHost?: string;
	imapPort?: number;
}): DetectedRoute {
	const providerMethodMap: Record<string, ConnectionMethod> = {
		gmail: "oauth-gmail",
		outlook: "oauth-outlook",
		feishu: "oauth-platform",
		dingtalk: "oauth-platform",
		wecom: "oauth-platform",
	};

	if (result.method === "oauth" && providerMethodMap[result.provider]) {
		return {
			method: providerMethodMap[result.provider],
			label: result.label,
			description: result.method === "oauth"
				? `通过 ${result.label} OAuth 安全连接，一键完成`
				: `通过 IMAP 协议连接 ${result.label}`,
			providerId: result.provider,
		};
	}

	if (result.method === "imap") {
		return {
			method: "imap",
			label: `IMAP 连接 — ${result.label}`,
			description: result.imapHost
				? `已识别为 ${result.label}，IMAP 服务器已自动填充`
				: "通过 IMAP 协议连接（需要应用专用密码）",
			providerId: "imap",
			imapHost: result.imapHost,
			imapPort: result.imapPort,
		};
	}

	return {
		method: "forward",
		label: "邮件转发",
		description: "未识别到邮箱服务商，推荐使用邮件转发体验 AI 解析",
		providerId: "forward",
	};
}

export function EmailConnectionsList() {
	const { activeOrganization } = useActiveOrganization();
	const queryClient = useQueryClient();
	const params = useParams();
	const organizationSlug = params.organizationSlug as string;

	usePageGuide("connectEmail", [
		{
			element: '[data-guide="connect-email-btn"]',
			title: "第 1 步：连接你的邮箱",
			description:
				"输入邮箱地址，系统会自动检测最佳连接方式。Gmail 和 Outlook 支持一键 OAuth，其他邮箱通过 IMAP 或转发连接。",
			side: "bottom",
		},
	]);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogStep, setDialogStep] = useState<DialogStep>("detect");
	const [emailInput, setEmailInput] = useState("");
	const [detectedRoute, setDetectedRoute] = useState<DetectedRoute | null>(null);
	const [isDetecting, setIsDetecting] = useState(false);
	const [platformId, setPlatformId] = useState<string>("");
	const [passwordDialogConn, setPasswordDialogConn] = useState<{ id: string; email: string } | null>(null);
	const [newImapPassword, setNewImapPassword] = useState("");

	const detectMutation = useMutation(
		orpc.emailConnections.detectProvider.mutationOptions(),
	);

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
		const labels: Record<string, string> = {
			gmail: "Gmail",
			outlook: "Outlook",
			feishu: "飞书",
			dingtalk: "钉钉",
			wecom: "企微",
			imap: "IMAP",
		};
		return labels[provider] ?? provider;
	};

	function handleClose() {
		setDialogOpen(false);
		setDialogStep("detect");
		setEmailInput("");
		setDetectedRoute(null);
		setPlatformId("");
	}

	function handleEmailDetect() {
		const email = emailInput.trim();
		if (!email.includes("@")) {
			return;
		}
		setIsDetecting(true);
		setDetectedRoute(null);
		detectMutation.mutate(
			{ email },
			{
				onSuccess: (result) => {
					const route = apiResultToRoute(result);
					setDetectedRoute(route);
					setIsDetecting(false);
				},
				onError: () => {
					setDetectedRoute({
						method: "forward",
						label: "邮件转发",
						description: "检测失败，推荐使用邮件转发",
						providerId: "forward",
					});
					setIsDetecting(false);
				},
			},
		);
	}

	function handleProceedWithRoute(route: DetectedRoute) {
		switch (route.method) {
			case "oauth-gmail":
				setDialogStep("gmail");
				break;
			case "oauth-outlook":
				setDialogStep("outlook");
				break;
		case "oauth-platform":
			setPlatformId(route.providerId);
			setDialogStep("platform-choice");
			break;
			case "imap":
				setDialogStep("imap");
				break;
			case "forward":
				setDialogStep("forward");
				break;
		}
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
				<Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { handleClose(); } else { setDialogOpen(true); } }}>
					<DialogTrigger asChild>
						<Button data-guide="connect-email-btn" data-connect-dialog-trigger onClick={() => { setDialogStep("detect"); setEmailInput(""); setDetectedRoute(null); }}>
							<PlusIcon className="mr-2 size-4" />
							连接邮箱
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-[520px]">
						{dialogStep === "detect" && (
							<SmartDetectStep
								emailInput={emailInput}
								setEmailInput={setEmailInput}
								detectedRoute={detectedRoute}
								isDetecting={isDetecting}
								onDetect={handleEmailDetect}
								onProceed={handleProceedWithRoute}
								onForward={() => setDialogStep("forward")}
							/>
						)}
						{dialogStep === "gmail" && (
							<GmailOAuthStep
								organizationId={activeOrganization?.id ?? ""}
								organizationSlug={organizationSlug}
								email={emailInput}
								onBack={() => setDialogStep("detect")}
							/>
						)}
						{dialogStep === "outlook" && (
							<OutlookOAuthStep
								organizationId={activeOrganization?.id ?? ""}
								organizationSlug={organizationSlug}
								email={emailInput}
								onBack={() => setDialogStep("detect")}
							/>
						)}
				{dialogStep === "platform-choice" && PLATFORMS[platformId] && (
					<PlatformChoiceStep
						platform={PLATFORMS[platformId]}
						onForward={() => setDialogStep("forward")}
						onOAuth={() => setDialogStep("platform")}
						onBack={() => setDialogStep("detect")}
					/>
				)}
				{dialogStep === "platform" && PLATFORMS[platformId] && (
					<PlatformOAuthStep
						platform={PLATFORMS[platformId]}
						organizationId={activeOrganization?.id ?? ""}
						organizationSlug={organizationSlug}
						onBack={() => setDialogStep("platform-choice")}
					/>
				)}
					{dialogStep === "imap" && (
						<ImapConnectStep
							organizationId={activeOrganization?.id ?? ""}
							email={emailInput}
							detectedImapHost={detectedRoute?.imapHost}
							detectedImapPort={detectedRoute?.imapPort}
							onBack={() => setDialogStep("detect")}
							onFallbackForward={() => setDialogStep("forward")}
							onSuccess={() => {
								handleClose();
								queryClient.invalidateQueries({
									queryKey: orpc.emailConnections.list.key(),
								});
							}}
						/>
					)}
				{dialogStep === "forward" && (
					<ForwardFallbackStep
						organizationId={activeOrganization?.id ?? ""}
						detectedProvider={platformId || undefined}
						onBack={() => setDialogStep(platformId ? "platform-choice" : "detect")}
						onClose={handleClose}
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
											点击上方「连接邮箱」输入邮箱地址，系统自动检测最佳方案。
										</p>
									</div>
								</TableCell>
							</TableRow>
						) : (
							connections.map((conn) => (
								<TableRow key={conn.id} data-connection-item>
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
										{conn.isActive && !["gmail", "outlook", "feishu"].includes(conn.provider) && !conn.hasImapPassword ? (
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
											{!["gmail", "outlook", "feishu"].includes(conn.provider) && !conn.hasImapPassword && (
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
							/>
							<p className="text-xs text-muted-foreground">
								请在邮箱设置中开启 IMAP 服务并生成专用密码。
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

/* ============================================================
   Step 1: Smart Detect — 输入邮箱自动检测最佳方案
   ============================================================ */
function SmartDetectStep({
	emailInput,
	setEmailInput,
	detectedRoute,
	isDetecting,
	onDetect,
	onProceed,
	onForward,
}: {
	emailInput: string;
	setEmailInput: (v: string) => void;
	detectedRoute: DetectedRoute | null;
	isDetecting: boolean;
	onDetect: () => void;
	onProceed: (route: DetectedRoute) => void;
	onForward: () => void;
}) {
	const isValidEmail = emailInput.includes("@") && emailInput.includes(".");

	return (
		<>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<SparklesIcon className="size-5 text-primary" />
					智能连接邮箱
				</DialogTitle>
				<DialogDescription>
					输入邮箱地址，系统通过 MX 记录自动识别邮箱服务商
				</DialogDescription>
			</DialogHeader>

			<div className="space-y-4 mt-2">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (isValidEmail && !isDetecting) {
							onDetect();
						}
					}}
				>
					<div className="flex gap-2">
						<Input
							type="email"
							placeholder="输入你的邮箱地址，如 you@company.com"
							value={emailInput}
							onChange={(e) => {
								setEmailInput(e.target.value);
							}}
							className="flex-1"
						/>
						<Button type="submit" disabled={!isValidEmail || isDetecting} size="sm" className="shrink-0 px-4">
							{isDetecting ? (
								<>
									<Loader2Icon className="size-4 mr-1 animate-spin" />
									检测中
								</>
							) : (
								<>
									<ZapIcon className="size-4 mr-1" />
									检测
								</>
							)}
						</Button>
					</div>
				</form>

				{isDetecting && (
					<div className="flex items-center gap-3 rounded-lg border border-dashed p-4 animate-pulse">
						<Spinner className="size-4 text-primary" />
						<div className="space-y-1">
							<p className="text-sm text-foreground font-medium">正在查询 MX 记录...</p>
							<p className="text-xs text-muted-foreground">
								分析域名 {emailInput.split("@")[1]} 的邮件服务商
							</p>
						</div>
					</div>
				)}

				{detectedRoute && (
					<div className="animate-in fade-in slide-in-from-top-2 duration-300">
						<div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-center gap-3">
									<div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
										{detectedRoute.method === "oauth-gmail" && (
											<Image src="/icons/integrations/gmail.svg" alt="Gmail" width={24} height={24} />
										)}
										{detectedRoute.method === "oauth-outlook" && (
											<Image src="/icons/integrations/outlook.svg" alt="Outlook" width={24} height={24} />
										)}
										{detectedRoute.method === "oauth-platform" && PLATFORMS[detectedRoute.providerId] && (
											<Image src={PLATFORMS[detectedRoute.providerId].icon} alt="" width={24} height={24} />
										)}
										{detectedRoute.method === "imap" && (
											<GlobeIcon className="size-5 text-primary" />
										)}
									</div>
									<div>
										<p className="text-sm font-semibold text-foreground">
											推荐：{detectedRoute.label}
										</p>
										<p className="text-xs text-muted-foreground">
											{detectedRoute.description}
										</p>
									</div>
								</div>
								{(detectedRoute.method === "oauth-gmail" || detectedRoute.method === "oauth-outlook") && (
									<span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 rounded-full bg-emerald-500/10 px-2 py-0.5 shrink-0">
										<ShieldCheckIcon className="size-3" />
										推荐
									</span>
								)}
							</div>

							<Button onClick={() => onProceed(detectedRoute)} className="w-full gap-2">
								{(detectedRoute.method === "oauth-gmail" || detectedRoute.method === "oauth-outlook") ? (
									<>
										<ExternalLinkIcon className="size-4" />
										一键授权连接
									</>
								) : (
									<>
										<ArrowRightIcon className="size-4" />
										继续连接
									</>
								)}
							</Button>
						</div>

						{/* Other options */}
						<div className="mt-3 space-y-2">
							{detectedRoute.method !== "forward" && (
								<p className="text-xs text-center text-muted-foreground">
									连接遇到问题？
									<button
										type="button"
										onClick={onForward}
										className="text-primary hover:underline ml-1 font-medium"
									>
										用邮件转发代替
									</button>
									，同样 10 秒完成
								</p>
							)}
						</div>
					</div>
				)}

				{!detectedRoute && (
					<div className="space-y-3">
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t" />
							</div>
							<div className="relative flex justify-center text-xs">
								<span className="bg-background px-2 text-muted-foreground">
									或直接选择
								</span>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-2">
							<QuickOAuthButton
								icon="/icons/integrations/gmail.svg"
								label="Gmail"
								onClick={() => {
									setEmailInput("@gmail.com");
									onProceed({
										method: "oauth-gmail",
										label: "Google 一键授权",
										description: "通过 Google OAuth 安全连接",
										providerId: "gmail",
									});
								}}
							/>
							<QuickOAuthButton
								icon="/icons/integrations/outlook.svg"
								label="Outlook"
								onClick={() => {
									setEmailInput("@outlook.com");
									onProceed({
										method: "oauth-outlook",
										label: "Microsoft 一键授权",
										description: "通过 Microsoft OAuth 安全连接",
										providerId: "outlook",
									});
								}}
							/>
						</div>

						<button
							type="button"
							onClick={onForward}
							className="flex items-center gap-3 rounded-lg border border-dashed p-3 transition-colors hover:bg-muted/50 hover:border-primary/30 w-full text-left"
						>
							<div className="flex size-9 items-center justify-center rounded-full bg-amber-500/10">
								<SendIcon className="size-4 text-amber-600 dark:text-amber-400" />
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-foreground">邮件转发（兜底方案）</p>
								<p className="text-xs text-muted-foreground">
									无需配置，直接转发一封邮件体验 AI 解析
								</p>
							</div>
							<ArrowRightIcon className="size-4 text-muted-foreground/50 shrink-0" />
						</button>
					</div>
				)}
			</div>
		</>
	);
}

function QuickOAuthButton({
	icon,
	label,
	onClick,
}: {
	icon: string;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex items-center gap-2.5 rounded-lg border p-3 transition-colors hover:bg-muted/50 hover:border-primary/30"
		>
			<Image src={icon} alt={label} width={24} height={24} />
			<span className="text-sm font-medium text-foreground">{label}</span>
			<span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 ml-auto">
				<ShieldCheckIcon className="size-3" />
				OAuth
			</span>
		</button>
	);
}

/* ============================================================
   Step 2a: Gmail OAuth
   ============================================================ */
function GmailOAuthStep({
	organizationId,
	organizationSlug,
	email,
	onBack,
}: {
	organizationId: string;
	organizationSlug: string;
	email: string;
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
		if (email?.includes("@")) {
			authUrl.searchParams.set("login_hint", email);
		}

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

				{email?.includes("@") && (
					<p className="text-sm text-foreground font-medium">{email}</p>
				)}

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

				<div className="w-full border-t pt-3 mt-1">
					<p className="text-xs text-muted-foreground text-center">
						企业邮箱 OAuth 被管理员限制？
						<button
							type="button"
							onClick={onBack}
							className="text-primary hover:underline font-medium ml-1"
						>
							返回选择其他方式
						</button>
					</p>
				</div>
			</div>
		</>
	);
}

/* ============================================================
   Step 2b: Outlook OAuth
   ============================================================ */
function OutlookOAuthStep({
	organizationId,
	organizationSlug,
	email,
	onBack,
}: {
	organizationId: string;
	organizationSlug: string;
	email: string;
	onBack: () => void;
}) {
	function handleConnect() {
		const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
		if (!clientId) {
			alert("Microsoft OAuth 尚未配置 (NEXT_PUBLIC_MICROSOFT_CLIENT_ID)");
			return;
		}

		const redirectUri = `${window.location.origin}/app/${organizationSlug}/connections/callback`;

		sessionStorage.setItem(
			"flowmail_oauth_state",
			JSON.stringify({ provider: "outlook", organizationId }),
		);

		const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
		authUrl.searchParams.set("client_id", clientId);
		authUrl.searchParams.set("redirect_uri", redirectUri);
		authUrl.searchParams.set("response_type", "code");
		authUrl.searchParams.set("scope", "openid email profile Mail.Read Mail.ReadWrite offline_access");
		authUrl.searchParams.set("state", organizationId);
		authUrl.searchParams.set("prompt", "consent");
		if (email?.includes("@")) {
			authUrl.searchParams.set("login_hint", email);
		}

		window.location.href = authUrl.toString();
	}

	return (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
						<ArrowLeftIcon className="size-4" />
					</button>
					<DialogTitle>连接 Outlook</DialogTitle>
				</div>
				<DialogDescription>
					通过 Microsoft OAuth 安全授权，支持 Outlook、Hotmail、Live 等邮箱。
				</DialogDescription>
			</DialogHeader>

			<div className="flex flex-col items-center gap-4 py-4">
				<Image src="/icons/integrations/outlook.svg" alt="Outlook" width={48} height={48} />

				{email?.includes("@") && (
					<p className="text-sm text-foreground font-medium">{email}</p>
				)}

				<div className="text-center space-y-1">
					<p className="text-sm text-muted-foreground">
						点击下方按钮将跳转到 Microsoft 登录页面
					</p>
					<p className="text-xs text-muted-foreground/60">
						授权后会自动返回 Flowmail
					</p>
				</div>
				<Button onClick={handleConnect} className="w-full gap-2">
					<ExternalLinkIcon className="size-4" />
					前往 Microsoft 授权
				</Button>

				<div className="w-full border-t pt-3 mt-1">
					<p className="text-xs text-muted-foreground text-center">
						企业邮箱 OAuth 被管理员限制？
						<button
							type="button"
							onClick={onBack}
							className="text-primary hover:underline font-medium ml-1"
						>
							返回选择其他方式
						</button>
					</p>
				</div>
			</div>
		</>
	);
}

/* ============================================================
   Step 2b-2: Platform Choice — 国产平台二选一
   ============================================================ */

const PLATFORM_CAPABILITIES: Record<string, { canRead: boolean; canSend: boolean }> = {
	feishu: { canRead: true, canSend: true },
	dingtalk: { canRead: false, canSend: false },
	wecom: { canRead: true, canSend: true },
};

function PlatformChoiceStep({
	platform,
	onForward,
	onOAuth,
	onBack,
}: {
	platform: PlatformDef;
	onForward: () => void;
	onOAuth: () => void;
	onBack: () => void;
}) {
	const caps = PLATFORM_CAPABILITIES[platform.id];
	return (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
						<ArrowLeftIcon className="size-4" />
					</button>
					<DialogTitle>连接 {platform.name}</DialogTitle>
				</div>
				<DialogDescription>
					检测到你使用 {platform.name}，请选择接入方式
				</DialogDescription>
			</DialogHeader>

			<div className="py-2 space-y-3">
				<button
					type="button"
					onClick={onForward}
					className="w-full text-left rounded-xl border-2 border-primary/30 bg-primary/5 p-4 hover:border-primary/50 transition-colors group"
				>
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<SendIcon className="size-4" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<span className="text-sm font-semibold text-foreground">邮件转发</span>
								<Badge status="info">推荐</Badge>
							</div>
							<p className="text-xs text-muted-foreground mt-1 leading-relaxed">
								零配置，10 秒体验 AI 解析。只需转发一封邮件即可开始，支持设置自动转发持续同步。
							</p>
						</div>
						<ArrowRightIcon className="size-4 mt-1 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
					</div>
				</button>

				<button
					type="button"
					onClick={onOAuth}
					className="w-full text-left rounded-xl border p-4 hover:border-primary/30 hover:bg-muted/30 transition-colors group"
				>
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
							<KeyIcon className="size-4" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<span className="text-sm font-semibold text-foreground">高级接入（OAuth）</span>
								{caps?.canSend && (
									<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
										<SparklesIcon className="size-2.5" />
										解锁 AI 发送
									</span>
								)}
							</div>
							<p className="text-xs text-muted-foreground mt-1 leading-relaxed">
								{caps?.canSend
									? "需要 IT 配合创建应用，接入后 AI 可代你发送审批回复、汇报跟进邮件。"
									: "需要 IT 配合在开放平台创建应用并提供凭据。"}
							</p>
							{!caps?.canSend && platform.id === "dingtalk" && (
								<p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
									注：钉钉暂无邮件读写 API，OAuth 仅用于身份验证
								</p>
							)}
						</div>
						<ArrowRightIcon className="size-4 mt-1 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
					</div>
				</button>
			</div>
		</>
	);
}

/* ============================================================
   Step 2c: Platform OAuth (飞书/钉钉/企微)
   ============================================================ */
function PlatformOAuthStep({
	platform,
	organizationId,
	organizationSlug,
	onBack,
}: {
	platform: PlatformDef;
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
				provider: platform.id,
				organizationId,
				appId: appId.trim(),
				appSecret: appSecret.trim(),
				...(imapPassword.trim() ? { imapPassword: imapPassword.trim() } : {}),
			}),
		);

		let authUrl: URL;

		if (platform.id === "feishu") {
			authUrl = new URL("https://accounts.feishu.cn/open-apis/authen/v1/authorize");
			authUrl.searchParams.set("client_id", appId.trim());
			authUrl.searchParams.set("redirect_uri", redirectUri);
			authUrl.searchParams.set("response_type", "code");
			authUrl.searchParams.set("scope", "contact:user.email:readonly mail:user_mailbox.message:readonly mail:user_mailbox.message.subject:read mail:user_mailbox.message.address:read mail:user_mailbox.message.body:read");
			authUrl.searchParams.set("state", organizationId);
		} else if (platform.id === "dingtalk") {
			authUrl = new URL("https://login.dingtalk.com/oauth2/auth");
			authUrl.searchParams.set("client_id", appId.trim());
			authUrl.searchParams.set("redirect_uri", redirectUri);
			authUrl.searchParams.set("response_type", "code");
			authUrl.searchParams.set("scope", "openid");
			authUrl.searchParams.set("prompt", "consent");
			authUrl.searchParams.set("state", organizationId);
		} else if (platform.id === "wecom") {
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

	const caps = PLATFORM_CAPABILITIES[platform.id];
	const [showItTemplate, setShowItTemplate] = useState(false);
	const [itCopied, setItCopied] = useState(false);
	const [showAgentPrompt, setShowAgentPrompt] = useState(false);
	const [promptCopied, setPromptCopied] = useState(false);

	const itTemplate = `Hi，

我们团队在使用 Flowmail（AI 邮件助手），它能自动分类邮件、追踪审批和汇报进展，提升团队邮件处理效率。

需要你帮忙在 ${platform.name} 开放平台创建一个企业自建应用，以便 Flowmail 能安全地同步和处理我们的邮件。

具体需要：
1. 登录 ${platform.docUrl}
2. 创建企业自建应用，名称填「Flowmail」
3. 申请以下权限：${platform.id === "feishu" ? "邮件读取（mail:user_mailbox.message:readonly）、邮件发送（mail:user_mailbox.message:send）" : platform.id === "wecom" ? "邮件（发送邮件+获取收件箱邮件）" : "基础通讯录读取"}
4. 将 ${platform.idLabel} 和 ${platform.secretLabel} 发给我

安全说明：
- Flowmail 通过加密通道传输数据，不明文存储邮件内容
- 仅解析邮件结构化信息（发件人、主题、关键字段），用于生成待办和提醒
- 不会代发任何邮件（除非主动开启 AI 回复功能）

谢谢！`;

	async function handleCopyItTemplate() {
		await navigator.clipboard.writeText(itTemplate);
		setItCopied(true);
		setTimeout(() => setItCopied(false), 2000);
	}

	const agentPrompt = `帮我在${platform.name}开放平台创建一个企业自建应用，用于接入 Flowmail。

需要你做的：
1. 打开 ${platform.docUrl}（我已经登录了）
2. 创建应用，名称填「Flowmail」，描述填「AI 邮件业务执行平台」
3. 申请${platform.id === "feishu" ? "邮件读取和发送权限（mail:user_mailbox.message:readonly, mail:user_mailbox.message:send 等）" : platform.id === "wecom" ? "邮件相关权限（发送邮件+获取收件箱邮件）" : "基础通讯录权限"}
4. 复制 ${platform.idLabel} 和 ${platform.secretLabel}
5. 调用 Flowmail MCP Tool \`connect_platform\` 提交凭据（provider: "${platform.id}"）

完成后告诉我结果。`;

	async function handleCopyAgentPrompt() {
		await navigator.clipboard.writeText(agentPrompt);
		setPromptCopied(true);
		setTimeout(() => setPromptCopied(false), 2000);
	}

	return (
		<div data-platform-oauth-open>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
						<ArrowLeftIcon className="size-4" />
					</button>
					<DialogTitle>高级接入 — {platform.name}</DialogTitle>
				</div>
				<DialogDescription>
					通过 OAuth 连接，需要在开放平台创建应用获取凭据。
				</DialogDescription>
			</DialogHeader>

			<div className="space-y-4 mt-2 max-h-[60vh] overflow-y-auto pr-1">
				{caps?.canSend && (
					<div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-3">
						<SparklesIcon className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
						<div className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">
							<span className="font-medium">OAuth 接入解锁 AI 发送能力</span> — 接入后 Flowmail 可代你发送审批回复、汇报跟进邮件，实现完整的 AI 自动化工作流。
						</div>
					</div>
				)}
				{!caps?.canSend && platform.id === "dingtalk" && (
					<div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
						<ZapIcon className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
						<div className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
							钉钉暂无邮件读写 API，OAuth 接入仅用于身份验证。邮件同步建议使用转发方式。
						</div>
					</div>
				)}

				<form
					className="space-y-3"
					onSubmit={(e) => {
						e.preventDefault();
						handleConnect();
					}}
				>
					<div className="flex items-center gap-3 rounded-lg bg-muted/50 border p-3">
						<Image src={platform.icon} alt={platform.name} width={28} height={28} />
						<div className="flex-1">
							<p className="text-sm font-medium text-foreground">{platform.name}</p>
							<p className="text-[10px] text-muted-foreground">
								{caps?.canSend ? "支持 AI 读取 + 发送" : caps?.canRead ? "支持 AI 读取" : "仅身份验证"}
							</p>
						</div>
					</div>

					<div className="space-y-2">
						<Label>{platform.idLabel}</Label>
						<Input
							placeholder={`输入 ${platform.idLabel}`}
							value={appId}
							onChange={(e) => setAppId(e.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label>{platform.secretLabel}</Label>
						<Input
							type="password"
							placeholder={`输入 ${platform.secretLabel}`}
							value={appSecret}
							onChange={(e) => setAppSecret(e.target.value)}
							required
						/>
					</div>

					{platform.id !== "feishu" && (
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
						</div>
					)}

					<Button type="submit" className="w-full gap-2" disabled={!appId.trim() || !appSecret.trim()}>
						<ExternalLinkIcon className="size-4" />
						前往授权
					</Button>
				</form>

				<div className="border-t pt-3 space-y-2">
					<p className="text-xs font-medium text-foreground">没有凭据？</p>
					<div className="flex flex-col gap-2">
						<a
							href={platform.docUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 rounded-lg border p-2.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
						>
							<ExternalLinkIcon className="size-3.5 shrink-0" />
							<span>前往 {platform.name} 开放平台创建应用</span>
						</a>
						<button
							type="button"
							onClick={() => setShowItTemplate(!showItTemplate)}
							className="flex items-center gap-2 rounded-lg border p-2.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors text-left"
						>
							<MailIcon className="size-3.5 shrink-0" />
							<span>复制话术发给 IT 同事帮忙创建</span>
						</button>
					</div>

					{showItTemplate && (
						<div className="rounded-lg border bg-muted/30 p-3 space-y-2">
							<pre className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
								{itTemplate}
							</pre>
							<Button
								variant="outline"
								size="sm"
								className="w-full gap-1.5"
								onClick={handleCopyItTemplate}
							>
								{itCopied ? (
									<CheckCircleIcon className="size-3.5 text-green-500" />
								) : (
									<CopyIcon className="size-3.5" />
								)}
								{itCopied ? "已复制" : "一键复制话术"}
							</Button>
						</div>
					)}

					<button
						type="button"
						onClick={() => setShowAgentPrompt(!showAgentPrompt)}
						className="flex items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2.5 text-xs text-primary hover:bg-primary/10 transition-colors text-left w-full"
					>
						<SparklesIcon className="size-3.5 shrink-0" />
						<span className="flex-1">让桌面 AI 助手帮我完成（OpenClaw / Cowork 等）</span>
						<ArrowRightIcon className="size-3 shrink-0" />
					</button>

					{showAgentPrompt && (
						<div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
							<div className="space-y-1.5">
								<p className="text-[11px] font-medium text-foreground">使用方法</p>
								<div className="space-y-1">
									<div className="flex items-start gap-2 text-[11px] text-muted-foreground">
										<span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">1</span>
										<span>复制下方 Prompt</span>
									</div>
									<div className="flex items-start gap-2 text-[11px] text-muted-foreground">
										<span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">2</span>
										<span>粘贴到你的桌面 AI 助手（OpenClaw、Cowork、WorkBuddy、Claude Desktop 等）</span>
									</div>
									<div className="flex items-start gap-2 text-[11px] text-muted-foreground">
										<span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">3</span>
										<span>AI 会自动打开浏览器、创建应用、回传凭据</span>
									</div>
								</div>
							</div>

							<div className="rounded-md border bg-background p-2.5">
								<pre className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto font-mono">
									{agentPrompt}
								</pre>
							</div>

							<Button
								variant="primary"
								size="sm"
								className="w-full gap-1.5"
								onClick={handleCopyAgentPrompt}
							>
								{promptCopied ? (
									<CheckCircleIcon className="size-3.5" />
								) : (
									<CopyIcon className="size-3.5" />
								)}
								{promptCopied ? "已复制 Prompt" : "复制 Prompt"}
							</Button>

							<p className="text-[10px] text-muted-foreground/50 leading-relaxed">
								需要你的 AI 助手已配置 Flowmail MCP 连接和浏览器控制能力。
								<a
									href="https://flowmail.ai/docs/agent-setup"
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary/70 hover:underline ml-0.5"
								>
									查看配置指南
								</a>
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

/* ============================================================
   Step 2d: IMAP Connect
   ============================================================ */
function ImapConnectStep({
	organizationId,
	email: initialEmail,
	detectedImapHost,
	detectedImapPort,
	onBack,
	onFallbackForward,
	onSuccess,
}: {
	organizationId: string;
	email: string;
	detectedImapHost?: string;
	detectedImapPort?: number;
	onBack: () => void;
	onFallbackForward: () => void;
	onSuccess: () => void;
}) {
	const [email, setEmail] = useState(initialEmail);
	const [password, setPassword] = useState("");
	const [imapHost, setImapHost] = useState(detectedImapHost ?? "");
	const [imapPort, setImapPort] = useState(detectedImapPort ? String(detectedImapPort) : "");
	const [maxSyncCount, setMaxSyncCount] = useState("500");

	const connectMutation = useMutation(
		orpc.emailConnections.connectImap.mutationOptions({ onSuccess }),
	);

	return (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
						<ArrowLeftIcon className="size-4" />
					</button>
					<DialogTitle>IMAP 连接</DialogTitle>
				</div>
				<DialogDescription>
					通过 IMAP 协议连接，需要应用专用密码。
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
						onChange={(e) => setEmail(e.target.value)}
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
					IMAP 服务器和端口会根据域名自动填充。
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

				<div className="border-t pt-3">
					<p className="text-xs text-muted-foreground text-center">
						不知道 IMAP 密码？
						<button
							type="button"
							onClick={onFallbackForward}
							className="text-primary hover:underline ml-1 font-medium"
						>
							改用邮件转发
						</button>
						，无需任何密码
					</p>
				</div>
			</form>
		</>
	);
}

/* ============================================================
   Step 2e: Forward Fallback — 转发兜底
   ============================================================ */
const PLATFORM_FORWARD_GUIDES: Record<string, { name: string; steps: { text: string; link?: string }[] }> = {
	feishu: {
		name: "飞书",
		steps: [
			{ text: "打开飞书客户端，点击左侧「邮箱」" },
			{ text: "点击右上角齿轮图标进入邮箱设置" },
			{ text: "找到「自动转发」，添加下方地址并保存", link: "https://www.feishu.cn/hc/zh-CN/articles/803023924253" },
			{ text: "前往收件箱，点击飞书发送的验证邮件完成确认" },
		],
	},
	dingtalk: {
		name: "钉钉",
		steps: [
			{ text: "打开电脑版钉钉，点击左侧「邮箱」图标" },
			{ text: "点击左下角「邮箱管理」→「账号设置」" },
			{ text: "点击「邮箱设置」→「自动转发」" },
			{ text: "添加下方转发地址并保存" },
		],
	},
	wecom: {
		name: "企业微信",
		steps: [
			{ text: "登录网页版企业邮箱 exmail.qq.com", link: "https://exmail.qq.com" },
			{ text: "点击右上角「设置」→「常规设置」→「自动转发」" },
			{ text: "用微信扫码完成安全验证" },
			{ text: "输入下方转发地址，点击「更新」保存" },
		],
	},
};

function ForwardFallbackStep({
	organizationId,
	detectedProvider,
	onBack,
	onClose,
}: {
	organizationId: string;
	detectedProvider?: string;
	onBack: () => void;
	onClose: () => void;
}) {
	const [copied, setCopied] = useState(false);

	const { data: addressData, isLoading: addressLoading } = useQuery(
		orpc.emailConnections.getInboundAddress.queryOptions({
			input: { organizationId },
			enabled: !!organizationId,
		}),
	);

	const { data: statusData } = useQuery(
		orpc.emailConnections.checkInboundStatus.queryOptions({
			input: { organizationId },
			enabled: !!organizationId,
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

	const hasReceived = statusData?.hasReceived ?? false;

	return (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
						<ArrowLeftIcon className="size-4" />
					</button>
					<DialogTitle>邮件转发</DialogTitle>
				</div>
				<DialogDescription>
					最简单的接入方式 — 零配置，10 秒体验 AI 解析
				</DialogDescription>
			</DialogHeader>

			<div className="py-2 space-y-4">
				<div className="space-y-2">
					<div className="flex items-center gap-2 text-sm font-medium">
						<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
							1
						</span>
						打开你的邮箱，转发一封邮件到
					</div>
					{addressLoading ? (
						<div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2.5">
							<Spinner className="size-4" />
							<span className="text-sm text-muted-foreground">加载地址中...</span>
						</div>
					) : (
						<div className="flex items-center gap-2">
							<code className="flex-1 rounded-lg border bg-muted/50 px-4 py-2.5 font-mono text-sm select-all truncate">
								{addressData?.address ?? "加载中..."}
							</code>
							<Button
								variant="outline"
								size="sm"
								onClick={handleCopy}
								className="shrink-0"
							>
								{copied ? (
									<CheckCircleIcon className="h-4 w-4 text-green-500" />
								) : (
									<CopyIcon className="h-4 w-4" />
								)}
								{copied ? "已复制" : "复制"}
							</Button>
						</div>
					)}
				</div>

				{detectedProvider && PLATFORM_FORWARD_GUIDES[detectedProvider] && (
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
							<GlobeIcon className="size-3.5" />
							{PLATFORM_FORWARD_GUIDES[detectedProvider].name} 自动转发设置教程
						</div>
						<div className="rounded-lg border bg-muted/30 p-3 space-y-2">
							{PLATFORM_FORWARD_GUIDES[detectedProvider].steps.map((step, i) => (
								<div key={i} className="flex items-start gap-2 text-xs">
									<span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted-foreground/15 text-[10px] font-semibold text-muted-foreground">
										{i + 1}
									</span>
									<span className="text-muted-foreground leading-relaxed">
										{step.text}
										{step.link && (
											<a
												href={step.link}
												target="_blank"
												rel="noopener noreferrer"
												className="text-primary hover:underline ml-1 inline-flex items-center gap-0.5"
											>
												查看详情
												<ExternalLinkIcon className="size-2.5" />
											</a>
										)}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				<div className="space-y-2">
					<div className="flex items-center gap-2 text-sm font-medium">
						<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
							2
						</span>
						等待 AI 解析结果
					</div>

					{hasReceived ? (
						<div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-3 space-y-1.5">
							<div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
								<CheckCircleIcon className="h-4 w-4" />
								已收到 {statusData?.totalCount} 封邮件
							</div>
							{statusData?.latest?.entity && (
								<p className="text-xs text-muted-foreground">
									最新: {statusData.latest.entity.title}
								</p>
							)}
							<Button
								onClick={onClose}
								size="sm"
								className="w-full mt-2"
							>
								前往查看
							</Button>
						</div>
					) : (
						<div className="rounded-lg border border-dashed p-3">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<MailIcon className="h-4 w-4 animate-pulse" />
								等待接收邮件...转发后通常几秒内即可看到结果
							</div>
						</div>
					)}
				</div>

				<div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
					<ShieldCheckIcon className="h-4 w-4 shrink-0 mt-0.5" />
					<span>
						Flowmail 仅解析邮件内容用于生成待办和提醒，不会代你发送任何邮件。
					</span>
				</div>
			</div>
		</>
	);
}
