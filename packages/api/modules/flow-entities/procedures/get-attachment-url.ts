import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { getSignedUrl } from "@repo/storage";
import { protectedProcedure } from "../../../orpc/procedures";
import { z } from "zod";

export const getAttachmentUrl = protectedProcedure
	.route({
		method: "GET",
		path: "/flow-entities/attachments/{attachmentId}/url",
		tags: ["FlowEntities"],
		summary: "Get a signed download URL for an email attachment",
	})
	.input(z.object({ attachmentId: z.string() }))
	.handler(async ({ input, context }) => {
		const attachment = await db.emailAttachment.findUnique({
			where: { id: input.attachmentId },
			include: {
				thread: {
					select: { organizationId: true },
				},
			},
		});

		if (!attachment) {
			throw new ORPCError("NOT_FOUND");
		}

		// Verify org membership
		const member = await db.member.findFirst({
			where: {
				organizationId: attachment.thread.organizationId,
				userId: context.user.id,
			},
		});
		if (!member) {
			throw new ORPCError("FORBIDDEN");
		}

		if (!attachment.storageKey) {
			throw new ORPCError("NOT_FOUND", {
				message: "Attachment content not stored",
			});
		}

		const storageEnabled = !!(
			process.env.S3_ENDPOINT &&
			process.env.S3_ACCESS_KEY_ID &&
			process.env.S3_SECRET_ACCESS_KEY
		);

		if (!storageEnabled) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Storage not configured",
			});
		}

		const url = await getSignedUrl(attachment.storageKey, {
			bucket: "attachments",
			expiresIn: 3600,
		});

		return {
			url,
			filename: attachment.filename,
			mimeType: attachment.mimeType,
			size: attachment.size,
		};
	});
