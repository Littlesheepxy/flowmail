"use client";

import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type CallbackStatus = "loading" | "success" | "syncing" | "error";

export default function OAuthCallbackPage() {
	const params = useParams();
	const searchParams = useSearchParams();
	const router = useRouter();
	const organizationSlug = params.organizationSlug as string;
	const processedRef = useRef(false);

	const [status, setStatus] = useState<CallbackStatus>("loading");
	const [message, setMessage] = useState("正在完成授权...");
	const [syncResult, setSyncResult] = useState<string>("");

	const code = searchParams.get("code");

	const gmailMutation = useMutation(
		orpc.emailConnections.connectGmail.mutationOptions(),
	);
	const oauthMutation = useMutation(
		orpc.emailConnections.connectOAuth.mutationOptions(),
	);
	const syncMutation = useMutation(
		orpc.emailConnections.sync.mutationOptions(),
	);

	function triggerSync(connectionId: string, email: string) {
		setStatus("syncing");
		setMessage(`已连接 ${email}，正在同步邮件...`);
		syncMutation.mutate(
			{ connectionId },
			{
				onSuccess: (result) => {
					setStatus("success");
					setSyncResult(
						`获取 ${result.fetched} 封邮件，处理 ${result.processed} 封`,
					);
					setMessage(`已成功连接 ${email}`);
				},
				onError: () => {
					setStatus("success");
					setMessage(`已成功连接 ${email}`);
					setSyncResult("首次同步未完成，可稍后手动同步");
				},
			},
		);
	}

	useEffect(() => {
		if (processedRef.current) {
			return;
		}
		processedRef.current = true;

		if (!code) {
			setStatus("error");
			setMessage("缺少授权码，请重新连接。");
			return;
		}

		const stored = sessionStorage.getItem("flowmail_oauth_state");
		if (!stored) {
			setStatus("error");
			setMessage("授权状态丢失，请重新连接。");
			return;
		}

		let oauthState: {
			provider: string;
			organizationId: string;
			appId?: string;
			appSecret?: string;
			imapPassword?: string;
		};

		try {
			oauthState = JSON.parse(stored);
		} catch {
			setStatus("error");
			setMessage("授权状态无效，请重新连接。");
			return;
		}

		sessionStorage.removeItem("flowmail_oauth_state");

		const redirectUri = `${window.location.origin}/app/${organizationSlug}/connections/callback`;

		if (oauthState.provider === "gmail") {
			gmailMutation.mutate(
				{
					organizationId: oauthState.organizationId,
					authCode: code,
					redirectUri,
				},
				{
					onSuccess: (data) => {
						triggerSync(data.id, data.email);
					},
					onError: (err) => {
						setStatus("error");
						setMessage(err.message || "Gmail 连接失败");
					},
				},
			);
		} else if (oauthState.appId && oauthState.appSecret) {
			oauthMutation.mutate(
				{
					organizationId: oauthState.organizationId,
					provider: oauthState.provider as "feishu" | "dingtalk" | "wecom",
					appId: oauthState.appId,
					appSecret: oauthState.appSecret,
					authCode: code,
					redirectUri,
					...(oauthState.imapPassword ? { imapPassword: oauthState.imapPassword } : {}),
				},
				{
					onSuccess: (data) => {
						triggerSync(data.id, data.email);
					},
					onError: (err) => {
						setStatus("error");
						setMessage(err.message || "OAuth 连接失败");
					},
				},
			);
		} else {
			setStatus("error");
			setMessage("缺少应用凭据，请重新连接。");
		}
	}, [code, organizationSlug, gmailMutation, oauthMutation]);

	return (
		<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
			{(status === "loading" || status === "syncing") && (
				<>
					<Spinner className="size-8 text-primary" />
					<p className="text-sm text-muted-foreground">{message}</p>
					{status === "syncing" && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<Loader2Icon className="size-3 animate-spin" />
							正在从邮箱拉取邮件，请稍候...
						</div>
					)}
				</>
			)}

			{status === "success" && (
				<>
					<div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
						<CheckCircle2Icon className="size-8 text-emerald-500" />
					</div>
					<h2 className="text-lg font-semibold">连接成功</h2>
					<p className="text-sm text-muted-foreground">{message}</p>
					{syncResult && (
						<p className="text-xs text-muted-foreground">{syncResult}</p>
					)}
					<Button
						onClick={() =>
							router.push(`/app/${organizationSlug}/inbox`)
						}
						className="mt-2"
					>
						前往收件箱
					</Button>
					<Button
						variant="outline"
						onClick={() =>
							router.push(`/app/${organizationSlug}/connections`)
						}
						size="sm"
					>
						管理连接
					</Button>
				</>
			)}

			{status === "error" && (
				<>
					<div className="flex size-16 items-center justify-center rounded-full bg-rose-500/10">
						<XCircleIcon className="size-8 text-rose-500" />
					</div>
					<h2 className="text-lg font-semibold">连接失败</h2>
					<p className="text-sm text-muted-foreground max-w-md text-center">
						{message}
					</p>
					<Button
						variant="outline"
						onClick={() =>
							router.push(`/app/${organizationSlug}/connections`)
						}
						className="mt-2"
					>
						返回重试
					</Button>
				</>
			)}
		</div>
	);
}
