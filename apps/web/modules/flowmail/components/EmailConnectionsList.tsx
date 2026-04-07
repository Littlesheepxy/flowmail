"use client";

import { Spinner } from "@repo/ui";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useTranslations } from "next-intl";
import { useState } from "react";
import { usePageGuide } from "../hooks/use-page-guide";

type AuthMethod = "oauth" | "imap";

interface ProviderDef {
	id: string;
	name: string;
	icon: string;
	method: AuthMethod;
	description: string;
	region: "global" | "china" | "universal";
	oauthUrl?: string;
	scopes?: string;
}

const PROVIDERS: ProviderDef[] = [
	{
		id: "gmail",
		name: "Gmail",
		icon: "/icons/integrations/gmail.svg",
		method: "oauth",
		region: "global",
		description: "Google Workspace / Gmail",
		oauthUrl: "https://accounts.google.com/o/oauth2/v2/auth",
		scopes: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
	},
	{
		id: "outlook",
		name: "Outlook",
		icon: "/icons/integrations/outlook.svg",
		method: "oauth",
		region: "global",
		description: "Microsoft 365 / Outlook",
		oauthUrl:
			"https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
		scopes: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
	},
	{
		id: "feishu",
		name: "Feishu",
		icon: "/icons/integrations/feishu.svg",
		method: "oauth",
		region: "china",
		description: "Lark OAuth",
		oauthUrl: "https://accounts.feishu.cn/open-apis/authen/v1/authorize",
	},
	{
		id: "dingtalk",
		name: "DingTalk",
		icon: "/icons/integrations/dingtalk.svg",
		method: "oauth",
		region: "china",
		description: "DingTalk OAuth",
		oauthUrl: "https://login.dingtalk.com/oauth2/auth",
		scopes: "openid",
	},
	{
		id: "wecom",
		name: "WeCom",
		icon: "/icons/integrations/wecom.png",
		method: "oauth",
		region: "china",
		description: "WeCom OAuth",
		oauthUrl: "https://open.weixin.qq.com/connect/oauth2/authorize",
	},
	{
		id: "imap",
		name: "IMAP",
		icon: "",
		method: "imap",
		region: "universal",
		description: "IMAP",
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

type FlowmailT = ReturnType<typeof useTranslations>;

function getProviderDisplayName(providerId: string, t: FlowmailT): string {
	switch (providerId) {
		case "feishu":
			return t("emailConnection.provider.lark.name");
		case "dingtalk":
			return t("emailConnection.provider.dingtalk.name");
		case "wecom":
			return t("emailConnection.provider.wecom.name");
		case "imap":
			return t("emailConnection.provider.other.name");
		default: {
			const found = PROVIDERS.find((p) => p.id === providerId);
			return found?.name ?? providerId;
		}
	}
}

function getProviderDisplayDescription(
	providerId: string,
	t: FlowmailT,
): string {
	switch (providerId) {
		case "feishu":
			return t("emailConnection.provider.lark.description");
		case "dingtalk":
			return t("emailConnection.provider.dingtalk.description");
		case "wecom":
			return t("emailConnection.provider.wecom.description");
		case "imap":
			return t("emailConnection.provider.other.description");
		default: {
			const found = PROVIDERS.find((p) => p.id === providerId);
			return found?.description ?? "";
		}
	}
}

export function EmailConnectionsList() {
	const t = useTranslations("flowmail");
	const { activeOrganization } = useActiveOrganization();
	const queryClient = useQueryClient();
	const params = useParams();
	const organizationSlug = params.organizationSlug as string;

	usePageGuide("connectEmail", [
		{
			element: '[data-guide="connect-email-btn"]',
			title: t("emailConnection.pageGuide.connectEmail.step1.title"),
			description: t(
				"emailConnection.pageGuide.connectEmail.step1.description",
			),
			side: "bottom",
		},
	]);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedProvider, setSelectedProvider] =
		useState<ProviderDef | null>(null);
	const [passwordDialogConn, setPasswordDialogConn] = useState<{
		id: string;
		email: string;
	} | null>(null);
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
					t("emailConnection.sync.toastSuccess", {
						fetched: result.fetched,
						processed: result.processed,
						errorPart: result.errors
							? t("emailConnection.sync.toastErrorsFailed", {
									count: result.errors,
								})
							: "",
					}),
				);
			},
			onError: (err) => {
				alert(
					t("emailConnection.sync.toastError", {
						error: err.message,
					}),
				);
			},
		}),
	);

	const connections = data ?? [];

	const providerLabel = (provider: string) =>
		getProviderDisplayName(provider, t);

	function handleClose() {
		setDialogOpen(false);
		setSelectedProvider(null);
	}

	return (
		<div data-module="connections" className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-lg">
						{t("emailConnection.page.title")}
					</h3>
					<p className="text-sm text-muted-foreground">
						{t("emailConnection.page.subtitle")}
					</p>
				</div>
				<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
					<DialogTrigger asChild>
						<Button
							data-guide="connect-email-btn"
							onClick={() => setSelectedProvider(null)}
						>
							<PlusIcon className="mr-2 size-4" />
							{t("emailConnection.action.connect")}
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
						) : selectedProvider.id === "outlook" ? (
							<OutlookOAuthForm
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
										queryKey:
											orpc.emailConnections.list.key(),
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
							<TableHead>
								{t("emailConnection.table.email")}
							</TableHead>
							<TableHead>
								{t("emailConnection.table.type")}
							</TableHead>
							<TableHead>
								{t("emailConnection.table.status")}
							</TableHead>
							<TableHead>
								{t("emailConnection.table.lastSync")}
							</TableHead>
							<TableHead className="text-right">
								{t("emailConnection.table.actions")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell
									colSpan={5}
									className="h-32 text-center"
								>
									<div className="flex items-center justify-center gap-2">
										<Spinner className="size-4 text-primary" />
										{t("common.loading")}
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
										<p>
											{t("emailConnection.empty.title")}
										</p>
										<p className="text-xs">
											{t("emailConnection.empty.hint")}
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
										<Badge status="info">
											{providerLabel(conn.provider)}
										</Badge>
									</TableCell>
									<TableCell>
										{conn.isActive &&
										!["gmail", "feishu"].includes(
											conn.provider,
										) &&
										!conn.hasImapPassword ? (
											<Badge status="warning">
												{t(
													"emailConnection.status.needsImapPassword",
												)}
											</Badge>
										) : (
											<Badge
												status={
													conn.isActive
														? "success"
														: "error"
												}
											>
												{conn.isActive
													? t(
															"emailConnection.status.connected",
														)
													: t(
															"emailConnection.status.disconnected",
														)}
											</Badge>
										)}
									</TableCell>
									<TableCell className="text-sm text-muted-foreground">
										{conn.lastSyncAt
											? new Date(
													conn.lastSyncAt,
												).toLocaleString()
											: t(
													"emailConnection.lastSync.never",
												)}
									</TableCell>
									<TableCell>
										<div className="flex justify-end gap-1">
											{!["gmail", "feishu"].includes(
												conn.provider,
											) &&
												!conn.hasImapPassword && (
													<Button
														size="icon"
														variant="ghost"
														title={t(
															"emailConnection.action.setImapPassword",
														)}
														onClick={() => {
															setPasswordDialogConn(
																{
																	id: conn.id,
																	email: conn.email,
																},
															);
															setNewImapPassword(
																"",
															);
														}}
													>
														<KeyIcon className="size-4 text-amber-500" />
													</Button>
												)}
											<Button
												size="icon"
												variant="ghost"
												title={t(
													"emailConnection.action.sync",
												)}
												disabled={
													syncMutation.isPending
												}
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
												title={t(
													"emailConnection.action.disconnect",
												)}
												disabled={
													disconnectMutation.isPending
												}
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
						<DialogTitle>
							{t("emailConnection.imapPasswordDialog.title")}
						</DialogTitle>
						<DialogDescription>
							{passwordDialogConn
								? t(
										"emailConnection.imapPasswordDialog.descriptionWithEmail",
										{ email: passwordDialogConn.email },
									)
								: t(
										"emailConnection.imapPasswordDialog.description",
									)}
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
							<Label>
								{t("emailConnection.imapPasswordDialog.label")}
							</Label>
							<Input
								type="password"
								placeholder={t(
									"emailConnection.imapPasswordDialog.placeholder",
								)}
								value={newImapPassword}
								onChange={(e) =>
									setNewImapPassword(e.target.value)
								}
								required
								autoFocus
							/>
							<p className="text-xs text-muted-foreground">
								{t(
									"emailConnection.imapPasswordDialog.hintProviderImap",
								)}
							</p>
						</div>
						<Button
							type="submit"
							className="w-full"
							disabled={
								!newImapPassword.trim() ||
								updatePwMutation.isPending
							}
						>
							{updatePwMutation.isPending
								? t("emailConnection.imapPasswordDialog.saving")
								: t("emailConnection.imapPasswordDialog.save")}
						</Button>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ProviderPicker({ onSelect }: { onSelect: (p: ProviderDef) => void }) {
	const t = useTranslations("flowmail");
	const globalProviders = PROVIDERS.filter((p) => p.region === "global");
	const chinaProviders = PROVIDERS.filter((p) => p.region === "china");
	const imapProvider = PROVIDERS.find((p) => p.id === "imap");

	function ProviderButton({ p }: { p: ProviderDef }) {
		const displayName = getProviderDisplayName(p.id, t);
		return (
			<button
				key={p.id}
				type="button"
				onClick={() => onSelect(p)}
				className="flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50 hover:border-primary/30"
			>
				<Image src={p.icon} alt={displayName} width={32} height={32} />
				<span className="text-sm font-medium text-foreground">
					{displayName}
				</span>
				<span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
					<ShieldCheckIcon className="size-3" />
					OAuth
				</span>
			</button>
		);
	}

	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{t("emailConnection.connectDialog.title")}
				</DialogTitle>
				<DialogDescription>
					{t("emailConnection.connectDialog.description")}
				</DialogDescription>
			</DialogHeader>

			<div className="grid grid-cols-2 gap-4 mt-2">
				<div className="space-y-2">
					<p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
						<GlobeIcon className="size-3" />
						{t("emailConnection.connectDialog.section.overseas")}
					</p>
					<div className="space-y-2">
						{globalProviders.map((p) => (
							<ProviderButton key={p.id} p={p} />
						))}
					</div>
				</div>

				<div className="space-y-2">
					<p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
						<MailIcon className="size-3" />
						{t("emailConnection.connectDialog.section.domestic")}
					</p>
					<div className="space-y-2">
						{chinaProviders.map((p) => (
							<ProviderButton key={p.id} p={p} />
						))}
					</div>
				</div>
			</div>

			{imapProvider && (
				<>
					<div className="relative my-2">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t" />
						</div>
						<div className="relative flex justify-center text-xs">
							<span className="bg-background px-2 text-muted-foreground">
								{t("common.or")}
							</span>
						</div>
					</div>
					<button
						type="button"
						onClick={() => onSelect(imapProvider)}
						className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 hover:border-primary/30 w-full text-left"
					>
						<div className="flex size-9 items-center justify-center rounded-full bg-muted">
							<KeyIcon className="size-4 text-muted-foreground" />
						</div>
						<div>
							<p className="text-sm font-medium text-foreground">
								{t(
									"emailConnection.connectDialog.imapRowTitle",
								)}
							</p>
							<p className="text-xs text-muted-foreground">
								{t(
									"emailConnection.connectDialog.imapRowSubtitle",
								)}
							</p>
						</div>
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
	const t = useTranslations("flowmail");
	function handleConnect() {
		const clientId = process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID;
		if (!clientId) {
			alert(t("emailConnection.errors.gmailOAuthNotConfigured"));
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
		authUrl.searchParams.set(
			"scope",
			"https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
		);
		authUrl.searchParams.set("access_type", "offline");
		authUrl.searchParams.set("prompt", "consent");
		authUrl.searchParams.set("state", organizationId);

		window.location.href = authUrl.toString();
	}

	return (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onBack}
						className="text-muted-foreground hover:text-foreground transition-colors"
					>
						<ArrowLeftIcon className="size-4" />
					</button>
					<DialogTitle>
						{t("emailConnection.gmailOAuth.title")}
					</DialogTitle>
				</div>
				<DialogDescription>
					{t("emailConnection.gmailOAuth.description")}
				</DialogDescription>
			</DialogHeader>

			<div className="flex flex-col items-center gap-4 py-4">
				<Image
					src="/icons/integrations/gmail.svg"
					alt="Gmail"
					width={48}
					height={48}
				/>
				<div className="text-center space-y-1">
					<p className="text-sm text-muted-foreground">
						{t("emailConnection.gmailOAuth.hintRedirect")}
					</p>
					<p className="text-xs text-muted-foreground/60">
						{t("emailConnection.gmailOAuth.hintReturn")}
					</p>
				</div>
				<Button onClick={handleConnect} className="w-full gap-2">
					<ExternalLinkIcon className="size-4" />
					{t("emailConnection.gmailOAuth.authorize")}
				</Button>
			</div>
		</>
	);
}

function OutlookOAuthForm({
	organizationId,
	organizationSlug,
	onBack,
}: {
	organizationId: string;
	organizationSlug: string;
	onBack: () => void;
}) {
	const t = useTranslations("flowmail");
	function handleConnect() {
		const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
		if (!clientId) {
			alert(t("emailConnection.errors.outlookOAuthNotConfigured"));
			return;
		}

		const redirectUri = `${window.location.origin}/app/${organizationSlug}/connections/callback`;

		sessionStorage.setItem(
			"flowmail_oauth_state",
			JSON.stringify({ provider: "outlook", organizationId }),
		);

		const authUrl = new URL(
			"https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
		);
		authUrl.searchParams.set("client_id", clientId);
		authUrl.searchParams.set("redirect_uri", redirectUri);
		authUrl.searchParams.set("response_type", "code");
		authUrl.searchParams.set(
			"scope",
			"https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
		);
		authUrl.searchParams.set("response_mode", "query");
		authUrl.searchParams.set("state", organizationId);

		window.location.href = authUrl.toString();
	}

	return (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onBack}
						className="text-muted-foreground hover:text-foreground transition-colors"
					>
						<ArrowLeftIcon className="size-4" />
					</button>
					<DialogTitle>
						{t("emailConnection.outlookOAuth.title")}
					</DialogTitle>
				</div>
				<DialogDescription>
					{t("emailConnection.outlookOAuth.description")}
				</DialogDescription>
			</DialogHeader>

			<div className="flex flex-col items-center gap-4 py-4">
				<Image
					src="/icons/integrations/outlook.svg"
					alt="Outlook"
					width={48}
					height={48}
				/>
				<div className="text-center space-y-1">
					<p className="text-sm text-muted-foreground">
						{t("emailConnection.outlookOAuth.hintRedirect")}
					</p>
					<p className="text-xs text-muted-foreground/60">
						{t("emailConnection.outlookOAuth.hintProviders")}
					</p>
				</div>
				<Button onClick={handleConnect} className="w-full gap-2">
					<ExternalLinkIcon className="size-4" />
					{t("emailConnection.outlookOAuth.authorize")}
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
	const t = useTranslations("flowmail");
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
				...(imapPassword.trim()
					? { imapPassword: imapPassword.trim() }
					: {}),
			}),
		);

		let authUrl: URL;

		if (provider.id === "feishu") {
			authUrl = new URL(
				"https://accounts.feishu.cn/open-apis/authen/v1/authorize",
			);
			authUrl.searchParams.set("client_id", appId.trim());
			authUrl.searchParams.set("redirect_uri", redirectUri);
			authUrl.searchParams.set("response_type", "code");
			authUrl.searchParams.set(
				"scope",
				"contact:user.email:readonly mail:user_mailbox.message:readonly mail:user_mailbox.message.subject:read mail:user_mailbox.message.address:read mail:user_mailbox.message.body:read",
			);
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
			authUrl = new URL(
				"https://open.weixin.qq.com/connect/oauth2/authorize",
			);
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

	const platformGuide: Record<
		string,
		{ docUrl: string; idLabel: string; secretLabel: string }
	> = {
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
					<button
						type="button"
						onClick={onBack}
						className="text-muted-foreground hover:text-foreground transition-colors"
					>
						<ArrowLeftIcon className="size-4" />
					</button>
					<DialogTitle>
						{t("emailConnection.platformOAuth.title", {
							provider: getProviderDisplayName(provider.id, t),
						})}
					</DialogTitle>
				</div>
				<DialogDescription>
					{t("emailConnection.platformOAuth.description")}
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
					<Image
						src={provider.icon}
						alt={provider.name}
						width={28}
						height={28}
					/>
					<div className="flex-1">
						<p className="text-sm font-medium text-foreground">
							{getProviderDisplayName(provider.id, t)}
						</p>
						<p className="text-xs text-muted-foreground">
							{getProviderDisplayDescription(provider.id, t)}
						</p>
					</div>
				</div>

				<div className="space-y-2">
					<Label>{guide?.idLabel ?? "App ID"}</Label>
					<Input
						placeholder={t(
							"emailConnection.platformOAuth.appIdPlaceholder",
						)}
						value={appId}
						onChange={(e) => setAppId(e.target.value)}
						required
					/>
				</div>
				<div className="space-y-2">
					<Label>{guide?.secretLabel ?? "App Secret"}</Label>
					<Input
						type="password"
						placeholder={t(
							"emailConnection.platformOAuth.appSecretPlaceholder",
						)}
						value={appSecret}
						onChange={(e) => setAppSecret(e.target.value)}
						required
					/>
				</div>

				{provider.id !== "feishu" && (
					<div className="space-y-2">
						<Label>
							{t(
								"emailConnection.platformOAuth.imapPasswordLabel",
							)}
							<span className="text-muted-foreground font-normal ml-1">
								{t(
									"emailConnection.platformOAuth.imapPasswordRequiredHint",
								)}
							</span>
						</Label>
						<Input
							type="password"
							placeholder={t(
								"emailConnection.platformOAuth.imapPasswordPlaceholder",
							)}
							value={imapPassword}
							onChange={(e) => setImapPassword(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							{t(
								"emailConnection.platformOAuth.imapPasswordHint",
							)}
						</p>
					</div>
				)}

				{guide?.docUrl && (
					<p className="text-xs text-muted-foreground">
						{t("emailConnection.platformOAuth.noCredentials")}
						<a
							href={guide.docUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline ml-1"
						>
							{t("emailConnection.platformOAuth.openPlatform")}
						</a>
					</p>
				)}

				<Button
					type="submit"
					className="w-full gap-2"
					disabled={!appId.trim() || !appSecret.trim()}
				>
					<ExternalLinkIcon className="size-4" />
					{t("emailConnection.platformOAuth.authorize")}
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
	const t = useTranslations("flowmail");
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
					<button
						type="button"
						onClick={onBack}
						className="text-muted-foreground hover:text-foreground transition-colors"
					>
						<ArrowLeftIcon className="size-4" />
					</button>
					<DialogTitle>
						{t("emailConnection.imapForm.title")}
					</DialogTitle>
				</div>
				<DialogDescription>
					{t("emailConnection.imapForm.description")}
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
						...(imapPort
							? { imapPort: Number.parseInt(imapPort, 10) }
							: {}),
						maxSyncCount: Number.parseInt(maxSyncCount, 10),
					});
				}}
			>
				<div className="space-y-2">
					<Label>{t("emailConnection.imapForm.emailLabel")}</Label>
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
					<Label>{t("emailConnection.imapForm.passwordLabel")}</Label>
					<Input
						type="password"
						placeholder={t(
							"emailConnection.imapForm.passwordPlaceholder",
						)}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
				</div>
				<div className="space-y-2">
					<Label>
						{t("emailConnection.imapForm.syncCountLabel")}
					</Label>
					<Select
						value={maxSyncCount}
						onValueChange={setMaxSyncCount}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="100">
								{t("emailConnection.imapForm.syncOption100")}
							</SelectItem>
							<SelectItem value="500">
								{t("emailConnection.imapForm.syncOption500")}
							</SelectItem>
							<SelectItem value="1000">
								{t("emailConnection.imapForm.syncOption1000")}
							</SelectItem>
							<SelectItem value="5000">
								{t("emailConnection.imapForm.syncOption5000")}
							</SelectItem>
							<SelectItem value="10000">
								{t("emailConnection.imapForm.syncOption10000")}
							</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-xs text-muted-foreground">
						{t("emailConnection.imapForm.syncCountHint")}
					</p>
				</div>

				<div className="grid grid-cols-3 gap-3">
					<div className="col-span-2 space-y-2">
						<Label>{t("emailConnection.imapForm.hostLabel")}</Label>
						<Input
							placeholder="imap.example.com"
							value={imapHost}
							onChange={(e) => setImapHost(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label>{t("emailConnection.imapForm.portLabel")}</Label>
						<Input
							placeholder="993"
							value={imapPort}
							onChange={(e) => setImapPort(e.target.value)}
						/>
					</div>
				</div>

				<p className="text-xs text-muted-foreground">
					{t("emailConnection.imapForm.autoFillHint")}
				</p>

				{connectMutation.error && (
					<p className="text-sm text-destructive">
						{connectMutation.error.message}
					</p>
				)}

				<Button
					type="submit"
					className="w-full"
					disabled={connectMutation.isPending}
				>
					{connectMutation.isPending && (
						<Spinner className="mr-2 size-4" />
					)}
					{t("emailConnection.imapForm.submit")}
				</Button>
			</form>
		</>
	);
}
