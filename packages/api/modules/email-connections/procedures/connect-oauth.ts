import { db, encryptSensitiveFields } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { connectOAuthSchema } from "../types";

const PROVIDER_CONFIG: Record<
	string,
	{
		tokenUrl: string;
		userInfoUrl?: string;
		buildTokenBody: (params: {
			appId: string;
			appSecret: string;
			code: string;
			redirectUri: string;
		}) => Record<string, string> | string;
		extractTokens: (data: unknown) => {
			accessToken: string;
			refreshToken?: string;
			expiresIn?: number;
		};
		extractEmail: (data: unknown) => string | null;
		tokenContentType?: string;
	}
> = {
	feishu: {
		tokenUrl: "https://open.feishu.cn/open-apis/authen/v2/oauth/token",
		userInfoUrl: "https://open.feishu.cn/open-apis/authen/v1/user_info",
		tokenContentType: "application/json",
		buildTokenBody: ({ appId, appSecret, code, redirectUri }) =>
			JSON.stringify({
				grant_type: "authorization_code",
				client_id: appId,
				client_secret: appSecret,
				code,
				redirect_uri: redirectUri,
			}),
		extractTokens: (data: unknown) => {
			const d = data as Record<string, unknown>;
			const nested = d.data as Record<string, unknown> | undefined;
			return {
				accessToken:
					(d.access_token as string) ??
					(nested?.access_token as string) ??
					"",
				refreshToken:
					(d.refresh_token as string) ??
					(nested?.refresh_token as string),
				expiresIn:
					(d.expires_in as number) ?? (nested?.expires_in as number),
			};
		},
		extractEmail: (data: unknown) => {
			const d = data as Record<string, unknown>;
			const nested = d.data as Record<string, unknown> | undefined;
			return (
				(nested?.enterprise_email as string) ??
				(d.enterprise_email as string) ??
				(nested?.email as string) ??
				(d.email as string) ??
				null
			);
		},
	},
	dingtalk: {
		tokenUrl: "https://api.dingtalk.com/v1.0/oauth2/userAccessToken",
		userInfoUrl: "https://api.dingtalk.com/v1.0/contact/users/me",
		tokenContentType: "application/json",
		buildTokenBody: ({ appId, appSecret, code }) =>
			JSON.stringify({
				clientId: appId,
				clientSecret: appSecret,
				code,
				grantType: "authorization_code",
			}),
		extractTokens: (data: unknown) => {
			const d = data as {
				accessToken?: string;
				refreshToken?: string;
				expireIn?: number;
			};
			return {
				accessToken: d.accessToken ?? "",
				refreshToken: d.refreshToken,
				expiresIn: d.expireIn,
			};
		},
		extractEmail: (data: unknown) => {
			const d = data as { email?: string };
			return d.email ?? null;
		},
	},
	wecom: {
		tokenUrl: "https://qyapi.weixin.qq.com/cgi-bin/gettoken",
		userInfoUrl:
			"https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo",
		tokenContentType: "url",
		buildTokenBody: ({ appId, appSecret }) =>
			`corpid=${encodeURIComponent(appId)}&corpsecret=${encodeURIComponent(appSecret)}`,
		extractTokens: (data: unknown) => {
			const d = data as { access_token?: string; expires_in?: number };
			return {
				accessToken: d.access_token ?? "",
				expiresIn: d.expires_in,
			};
		},
		extractEmail: (data: unknown) => {
			const d = data as {
				biz_mail?: string;
				email?: string;
				userid?: string;
			};
			return d.biz_mail ?? d.email ?? null;
		},
	},
};

export const connectOAuth = protectedProcedure
	.route({
		method: "POST",
		path: "/email-connections/oauth",
		tags: ["EmailConnections"],
		summary: "Connect an email account via OAuth (Feishu, DingTalk, WeCom)",
	})
	.input(connectOAuthSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);
		const config = PROVIDER_CONFIG[input.provider];
		if (!config) {
			throw new Error(`Unsupported OAuth provider: ${input.provider}`);
		}

		let tokenUrl = config.tokenUrl;
		const isUrlParams = config.tokenContentType === "url";

		if (isUrlParams) {
			const body = config.buildTokenBody({
				appId: input.appId,
				appSecret: input.appSecret,
				code: input.authCode,
				redirectUri: input.redirectUri,
			});
			tokenUrl = `${tokenUrl}?${body}`;
		}

		const tokenRes = await fetch(tokenUrl, {
			method: isUrlParams ? "GET" : "POST",
			headers: isUrlParams
				? {}
				: { "Content-Type": "application/json; charset=utf-8" },
			...(!isUrlParams && {
				body: config.buildTokenBody({
					appId: input.appId,
					appSecret: input.appSecret,
					code: input.authCode,
					redirectUri: input.redirectUri,
				}) as string,
			}),
		});

		if (!tokenRes.ok) {
			const errorText = await tokenRes.text();
			throw new Error(
				`Token exchange failed (${tokenRes.status}): ${errorText}`,
			);
		}

		const tokenData = await tokenRes.json();

		const tokens = config.extractTokens(tokenData);

		if (!tokens.accessToken) {
			throw new Error("No access token returned from OAuth provider");
		}

		let email = config.extractEmail(tokenData);

		if (!email && config.userInfoUrl) {
			let userInfoUrl = config.userInfoUrl;
			if (input.provider === "wecom") {
				userInfoUrl = `${userInfoUrl}?access_token=${tokens.accessToken}&code=${input.authCode}`;
			}

			const userRes = await fetch(userInfoUrl, {
				headers:
					input.provider === "wecom"
						? {}
						: { Authorization: `Bearer ${tokens.accessToken}` },
			});

			if (userRes.ok) {
				const userData = await userRes.json();
				email = config.extractEmail(userData);
			}
		}

		if (!email) {
			throw new Error(
				"Could not retrieve email address from OAuth provider. Please ensure the app has email access permissions.",
			);
		}

		const IMAP_DEFAULTS: Record<string, { host: string; port: number; smtpHost: string; smtpPort: number }> = {
			feishu: { host: "imap.feishu.cn", port: 993, smtpHost: "smtp.feishu.cn", smtpPort: 465 },
			dingtalk: { host: "imap.dingtalk.com", port: 993, smtpHost: "smtp.dingtalk.com", smtpPort: 465 },
			wecom: { host: "imap.exmail.qq.com", port: 993, smtpHost: "smtp.exmail.qq.com", smtpPort: 465 },
		};
		const imapDefaults = IMAP_DEFAULTS[input.provider];

		const encryptedCreate = encryptSensitiveFields({
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken ?? "",
			appSecret: input.appSecret,
			imapPassword: input.imapPassword ?? null,
		});
		const encryptedUpdate = encryptSensitiveFields({
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken ?? undefined,
			appSecret: input.appSecret,
			...(input.imapPassword ? { imapPassword: input.imapPassword } : {}),
		});

		const connection = await db.emailConnection.upsert({
			where: {
				organizationId_email: {
					organizationId: input.organizationId,
					email,
				},
			},
			create: {
				organizationId: input.organizationId,
				provider: input.provider,
				authType: input.imapPassword ? "password" : "oauth2",
				email,
				...encryptedCreate,
				tokenExpiresAt: tokens.expiresIn
					? new Date(Date.now() + tokens.expiresIn * 1000)
					: null,
				appId: input.appId,
				imapHost: imapDefaults?.host ?? null,
				imapPort: imapDefaults?.port ?? null,
				smtpHost: imapDefaults?.smtpHost ?? null,
				smtpPort: imapDefaults?.smtpPort ?? null,
				isActive: true,
			},
			update: {
				...encryptedUpdate,
				tokenExpiresAt: tokens.expiresIn
					? new Date(Date.now() + tokens.expiresIn * 1000)
					: null,
				appId: input.appId,
				imapHost: imapDefaults?.host ?? undefined,
				imapPort: imapDefaults?.port ?? undefined,
				smtpHost: imapDefaults?.smtpHost ?? undefined,
				smtpPort: imapDefaults?.smtpPort ?? undefined,
				...(input.imapPassword ? { authType: "password" } : {}),
				isActive: true,
			},
		});

		return {
			id: connection.id,
			email: connection.email,
			provider: connection.provider,
		};
	});
