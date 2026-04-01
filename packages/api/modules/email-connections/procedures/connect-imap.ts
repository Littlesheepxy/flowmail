import { db } from "@repo/database";
import { getConnector } from "@repo/email-processor";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { connectImapSchema } from "../types";

const PROVIDER_DEFAULTS: Record<
	string,
	{ imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }
> = {
	feishu: {
		imapHost: "imap.feishu.cn",
		imapPort: 993,
		smtpHost: "smtp.feishu.cn",
		smtpPort: 465,
	},
	dingtalk: {
		imapHost: "imap.dingtalk.com",
		imapPort: 993,
		smtpHost: "smtp.dingtalk.com",
		smtpPort: 465,
	},
	wecom: {
		imapHost: "imap.exmail.qq.com",
		imapPort: 993,
		smtpHost: "smtp.exmail.qq.com",
		smtpPort: 465,
	},
};

export const connectImap = protectedProcedure
	.route({
		method: "POST",
		path: "/email-connections/imap",
		tags: ["EmailConnections"],
		summary: "Connect an email account via IMAP (Feishu, DingTalk, WeCom, generic)",
	})
	.input(connectImapSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const defaults = PROVIDER_DEFAULTS[input.provider];
		const imapHost = input.imapHost ?? defaults?.imapHost ?? "";
		const imapPort = input.imapPort ?? defaults?.imapPort ?? 993;
		const smtpHost = input.smtpHost ?? defaults?.smtpHost ?? "";
		const smtpPort = input.smtpPort ?? defaults?.smtpPort ?? 465;

		const connector = getConnector(input.provider);
		const ok = await connector.testConnection({
			provider: input.provider,
			email: input.email,
			imapHost,
			imapPort,
			imapPassword: input.password,
			authType: "password",
		});

		if (!ok) {
			throw new Error(
				"Connection test failed. Please check your email, password, and server settings.",
			);
		}

		const maxSyncCount = input.maxSyncCount ?? 500;

		const connection = await db.emailConnection.upsert({
			where: {
				organizationId_email: {
					organizationId: input.organizationId,
					email: input.email,
				},
			},
			create: {
				organizationId: input.organizationId,
				provider: input.provider,
				authType: "password",
				email: input.email,
				imapHost,
				imapPort,
				smtpHost,
				smtpPort,
				imapPassword: input.password,
				maxSyncCount,
				isActive: true,
			},
			update: {
				provider: input.provider,
				authType: "password",
				imapHost,
				imapPort,
				smtpHost,
				smtpPort,
				imapPassword: input.password,
				maxSyncCount,
				isActive: true,
			},
		});

		return {
			id: connection.id,
			email: connection.email,
			provider: connection.provider,
		};
	});
