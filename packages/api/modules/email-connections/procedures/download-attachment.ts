import { ORPCError } from "@orpc/client";
import { db, decryptSensitiveFields } from "@repo/database";
import { z } from "zod/v4";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { ensureFeishuOAuthAccessToken } from "../lib/feishu-oauth-token";

const downloadAttachmentSchema = z.object({
	attachmentId: z.string(),
});

export const downloadAttachment = protectedProcedure
	.route({
		method: "GET",
		path: "/email-attachments/{attachmentId}/download",
		tags: ["EmailConnections"],
		summary: "Get download URL for an email attachment",
	})
	.input(downloadAttachmentSchema)
	.handler(async ({ input, context }) => {
		const attachment = await db.emailAttachment.findUnique({
			where: { id: input.attachmentId },
			include: {
				thread: {
					select: {
						connectionId: true,
						connection: {
							select: {
								id: true,
								organizationId: true,
								provider: true,
								authType: true,
								accessToken: true,
								refreshToken: true,
								tokenExpiresAt: true,
								appId: true,
								appSecret: true,
								email: true,
							},
						},
					},
				},
			},
		});

		if (!attachment) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(
			attachment.thread.connection.organizationId,
			context.user.id,
		);

		let conn = decryptSensitiveFields(attachment.thread.connection);
		if (conn.provider === "feishu") {
			conn = await ensureFeishuOAuthAccessToken(conn);
		}

		const { provider, accessToken, email } = conn;

		if (!accessToken) {
			throw new ORPCError("BAD_REQUEST", {
				message: "邮箱缺少 access token，请重新授权连接",
			});
		}

		let proxyUrl: string;
		if (provider === "feishu") {
			const mailboxId = encodeURIComponent(email || "me");
			proxyUrl = `https://open.feishu.cn/open-apis/mail/v1/user_mailboxes/${mailboxId}/messages/attachment_download`;
		} else if (provider === "gmail") {
			const [messageId, attachmentId] = attachment.externalId.split("/");
			proxyUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
		} else {
			throw new ORPCError("BAD_REQUEST", {
				message: `Attachment download not supported for provider: ${provider}`,
			});
		}

		const proxyRes = await fetch(proxyUrl, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		if (!proxyRes.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: `Failed to fetch attachment from ${provider}: ${proxyRes.status}`,
			});
		}

		const data = await proxyRes.text();
		return {
			data,
			externalId: attachment.externalId,
			filename: attachment.filename,
			mimeType: attachment.mimeType,
			provider,
		};
	});
