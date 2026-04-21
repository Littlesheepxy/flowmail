import type { AuthClientErrorCodes } from "@repo/auth/client";
import { useTranslations } from "next-intl";

/**
 * better-auth 的 client 错误对象有多种形状：
 * - throw 出来的 APIError：{ code, message, status }
 * - fetch 层包装：{ error: { code, message, status } }
 * - 旧 / BetterFetchError：{ status, statusText, message }
 * - 有时直接给 { message: "Password too short" } 而无 code
 *
 * 从任意一种里把 ERROR_CODE（全大写下划线）提取出来；拿不到就回退到
 * 从 message 文本推断（最后兜底，避免前端只显示 "unknown"）。
 */
export function extractAuthErrorCode(err: unknown): string | undefined {
	if (!err || typeof err !== "object") {
		return undefined;
	}
	const obj = err as Record<string, unknown>;
	if (typeof obj.code === "string" && obj.code) {
		return obj.code;
	}
	if (obj.error && typeof obj.error === "object") {
		const ec = (obj.error as Record<string, unknown>).code;
		if (typeof ec === "string" && ec) {
			return ec;
		}
	}
	const innerMsg =
		obj.error &&
		typeof obj.error === "object" &&
		typeof (obj.error as Record<string, unknown>).message === "string"
			? ((obj.error as Record<string, unknown>).message as string)
			: "";
	const msg = [typeof obj.message === "string" ? obj.message : "", innerMsg]
		.join(" ")
		.toLowerCase();
	if (!msg) {
		return undefined;
	}
	if (msg.includes("password") && msg.includes("short")) {
		return "PASSWORD_TOO_SHORT";
	}
	if (msg.includes("password") && msg.includes("long")) {
		return "PASSWORD_TOO_LONG";
	}
	if (msg.includes("already exists") || msg.includes("already registered")) {
		return "USER_ALREADY_EXISTS";
	}
	if (msg.includes("invalid email")) {
		return "INVALID_EMAIL";
	}
	if (msg.includes("invalid") && msg.includes("invite")) {
		return "INVALID_INVITE_CODE";
	}
	if (msg.includes("too many requests")) {
		return "TOO_MANY_REQUESTS";
	}
	return undefined;
}

export function useAuthErrorMessages() {
	const t = useTranslations();

	const authErrorMessages: Partial<
		Record<keyof AuthClientErrorCodes, string>
	> = {
		INVALID_EMAIL_OR_PASSWORD: t("auth.errors.invalidEmailOrPassword"),
		USER_NOT_FOUND: t("auth.errors.userNotFound"),
		FAILED_TO_CREATE_USER: t("auth.errors.failedToCreateUser"),
		FAILED_TO_CREATE_SESSION: t("auth.errors.failedToCreateSession"),
		FAILED_TO_UPDATE_USER: t("auth.errors.failedToUpdateUser"),
		FAILED_TO_GET_SESSION: t("auth.errors.failedToGetSession"),
		INVALID_PASSWORD: t("auth.errors.invalidPassword"),
		INVALID_EMAIL: t("auth.errors.invalidEmail"),
		INVALID_TOKEN: t("auth.errors.invalidToken"),
		CREDENTIAL_ACCOUNT_NOT_FOUND: t(
			"auth.errors.credentialAccountNotFound",
		),
		EMAIL_CAN_NOT_BE_UPDATED: t("auth.errors.emailCanNotBeUpdated"),
		EMAIL_NOT_VERIFIED: t("auth.errors.emailNotVerified"),
		FAILED_TO_GET_USER_INFO: t("auth.errors.failedToGetUserInfo"),
		ID_TOKEN_NOT_SUPPORTED: t("auth.errors.idTokenNotSupported"),
		PASSWORD_TOO_LONG: t("auth.errors.passwordTooLong"),
		PASSWORD_TOO_SHORT: t("auth.errors.passwordTooShort"),
		PROVIDER_NOT_FOUND: t("auth.errors.providerNotFound"),
		SOCIAL_ACCOUNT_ALREADY_LINKED: t(
			"auth.errors.socialAccountAlreadyLinked",
		),
		USER_EMAIL_NOT_FOUND: t("auth.errors.userEmailNotFound"),
		USER_ALREADY_EXISTS: t("auth.errors.userAlreadyExists"),
		USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: t(
			"auth.errors.userAlreadyExistsUseAnotherEmail",
		),
		INVALID_INVITATION: t("auth.errors.invalidInvitation"),
		INVALID_INVITE_CODE: t("auth.errors.invalidInviteCode"),
		SESSION_EXPIRED: t("auth.errors.sessionExpired"),
		FAILED_TO_UNLINK_LAST_ACCOUNT: t(
			"auth.errors.failedToUnlinkLastAccount",
		),
		ACCOUNT_NOT_FOUND: t("auth.errors.accountNotFound"),
		// 非 better-auth 官方 code，我们自己兜底识别出来的
		TOO_MANY_REQUESTS: t("auth.errors.tooManyRequests"),
	} as Record<string, string>;

	const getAuthErrorMessage = (errorCode: string | undefined) => {
		return (
			authErrorMessages[errorCode as keyof typeof authErrorMessages] ||
			t("auth.errors.unknown")
		);
	};

	return {
		getAuthErrorMessage,
	};
}
