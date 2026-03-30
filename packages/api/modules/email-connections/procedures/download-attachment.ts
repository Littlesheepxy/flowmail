import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { z } from "zod/v4";
import { protectedProcedure } from "../../../orpc/procedures";

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
	.handler(async ({ input }) => {
		const attachment = await db.emailAttachment.findUnique({
			where: { id: input.attachmentId },
			include: {
				thread: {
					select: {
						connectionId: true,
						connection: {
							select: {
								provider: true,
								accessToken: true,
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

		const { provider, accessToken, email } = attachment.thread.connection;

		if (provider === "feishu") {
			const mailboxId = encodeURIComponent(email || "me");
			const url = `https://open.feishu.cn/open-apis/mail/v1/user_mailboxes/${mailboxId}/messages/attachment_download`;
			return {
				downloadUrl: url,
				token: accessToken,
				externalId: attachment.externalId,
				filename: attachment.filename,
				mimeType: attachment.mimeType,
				provider,
			};
		}

		if (provider === "gmail") {
			const [messageId, attachmentId] = attachment.externalId.split("/");
			const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
			return {
				downloadUrl: url,
				token: accessToken,
				externalId: attachment.externalId,
				filename: attachment.filename,
				mimeType: attachment.mimeType,
				provider,
			};
		}

		throw new ORPCError("BAD_REQUEST", {
			message: `Attachment download not supported for provider: ${provider}`,
		});
	});
