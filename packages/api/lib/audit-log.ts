import { db } from "@repo/database";
import { logger } from "@repo/logs";

type AuditAction =
	| "LOGIN"
	| "LOGOUT"
	| "SIGNUP"
	| "OTP_REQUEST"
	| "OTP_VERIFY"
	| "PASSWORD_RESET"
	| "EMAIL_CONNECTION_CREATE"
	| "EMAIL_CONNECTION_DELETE"
	| "EMAIL_SYNC"
	| "EMAIL_SEND"
	| "INBOUND_EMAIL_RECEIVED"
	| "ENTITY_STATUS_CHANGE"
	| "ENTITY_APPROVE"
	| "ENTITY_REJECT"
	| "API_TOKEN_CREATE"
	| "API_TOKEN_REVOKE"
	| "MEMBER_INVITE"
	| "MEMBER_REMOVE"
	| "ORGANIZATION_CREATE"
	| "ORGANIZATION_DELETE"
	| "SETTINGS_CHANGE"
	| "DATA_EXPORT";

interface AuditLogEntry {
	organizationId?: string;
	userId?: string;
	action: AuditAction;
	targetType?: string;
	targetId?: string;
	metadata?: Record<string, unknown>;
	ipAddress?: string;
	userAgent?: string;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
	try {
		await db.auditLog.create({
			data: {
				organizationId: entry.organizationId ?? null,
				userId: entry.userId ?? null,
				action: entry.action,
				targetType: entry.targetType ?? null,
				targetId: entry.targetId ?? null,
				metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
				ipAddress: entry.ipAddress ?? null,
				userAgent: entry.userAgent ?? null,
			},
		});
	} catch (error) {
		logger.error("Failed to write audit log", { error, entry });
	}
}

export function extractRequestMeta(request: Request) {
	const forwarded = request.headers.get("x-forwarded-for");
	const ipAddress = forwarded
		? forwarded.split(",")[0].trim()
		: request.headers.get("x-real-ip") ?? undefined;
	const userAgent = request.headers.get("user-agent") ?? undefined;
	return { ipAddress, userAgent };
}
