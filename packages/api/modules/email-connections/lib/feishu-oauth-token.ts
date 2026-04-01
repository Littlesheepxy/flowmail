import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";

const FEISHU_TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v2/oauth/token";
/** 提前刷新，避免边界时刻 401 */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const DEFAULT_EXPIRES_SEC = 7200;

interface FeishuConnectionRow {
	id: string;
	provider: string;
	authType: string;
	accessToken: string | null;
	refreshToken: string | null;
	tokenExpiresAt: Date | null;
	appId: string | null;
	appSecret: string | null;
}

function parseFeishuAuthenPayload(json: Record<string, unknown>): {
	accessToken: string;
	refreshToken?: string;
	expiresIn?: number;
} {
	const data = (json.data as Record<string, unknown> | undefined) ?? json;
	const accessToken = String(data.access_token ?? "");
	const refreshToken = data.refresh_token as string | undefined;
	const expiresIn = data.expires_in as number | undefined;
	return { accessToken, refreshToken, expiresIn };
}

/**
 * 使用 refresh_token 换取新的 user_access_token（飞书开放平台 authen v2）
 */
export async function refreshFeishuUserAccessToken(input: {
	refreshToken: string;
	appId: string;
	appSecret: string;
}): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
	const res = await fetch(FEISHU_TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json; charset=utf-8" },
		body: JSON.stringify({
			grant_type: "refresh_token",
			refresh_token: input.refreshToken,
			client_id: input.appId,
			client_secret: input.appSecret,
		}),
	});

	const json = (await res.json()) as Record<string, unknown>;
	const code = json.code as number | undefined;
	if (code !== 0) {
		const msg = String(json.msg ?? "unknown");
		throw new ORPCError("BAD_REQUEST", {
			message: `飞书 access_token 已失效且无法刷新，请重新授权邮箱连接：${msg}`,
		});
	}

	const parsed = parseFeishuAuthenPayload(json);
	if (!parsed.accessToken) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "飞书刷新 token 响应缺少 access_token",
		});
	}
	return parsed;
}

/**
 * 若飞书 OAuth 连接临近过期或已过期，则刷新并写回数据库，返回最新连接行。
 * 非飞书或非 oauth2 连接原样返回。
 */
export async function ensureFeishuOAuthAccessToken<T extends FeishuConnectionRow>(
	connection: T,
): Promise<T> {
	if (connection.provider !== "feishu" || connection.authType !== "oauth2") {
		return connection;
	}

	const refreshToken = connection.refreshToken?.trim();
	const appId = connection.appId?.trim();
	const appSecret = connection.appSecret?.trim();
	if (!refreshToken || !appId || !appSecret) {
		return connection;
	}

	const expiresAtMs = connection.tokenExpiresAt?.getTime();
	const needsRefresh =
		expiresAtMs == null ||
		expiresAtMs <= Date.now() + REFRESH_BUFFER_MS;

	if (!needsRefresh) {
		return connection;
	}

	const tokens = await refreshFeishuUserAccessToken({
		refreshToken,
		appId,
		appSecret,
	});

	const expiresIn = tokens.expiresIn ?? DEFAULT_EXPIRES_SEC;
	const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

	const updated = await db.emailConnection.update({
		where: { id: connection.id },
		data: {
			accessToken: tokens.accessToken,
			...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
			tokenExpiresAt,
		},
	});

	return { ...connection, ...updated } as T;
}
