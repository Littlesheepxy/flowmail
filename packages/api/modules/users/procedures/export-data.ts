import { db, decryptEmailContent } from "@repo/database";
import { z } from "zod/v4";
import { writeAuditLog } from "../../../lib/audit-log";
import { protectedProcedure } from "../../../orpc/procedures";

const exportDataSchema = z.object({
	organizationId: z.string(),
	includeEmails: z.boolean().default(true),
	includeEntities: z.boolean().default(true),
	includeTimeline: z.boolean().default(true),
});

export const exportUserData = protectedProcedure
	.route({
		method: "POST",
		path: "/users/export-data",
		tags: ["Users"],
		summary: "Export all personal data for GDPR/CCPA data portability",
	})
	.input(exportDataSchema)
	.handler(async ({ input, context }) => {
		const membership = await db.organizationMember.findFirst({
			where: {
				organizationId: input.organizationId,
				userId: context.user.id,
			},
		});

		if (!membership) {
			throw new Error("Not a member of this organization");
		}

		const user = await db.user.findUnique({
			where: { id: context.user.id },
			select: {
				id: true,
				name: true,
				email: true,
				emailVerified: true,
				image: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		const organization = await db.organization.findUnique({
			where: { id: input.organizationId },
			select: {
				id: true,
				name: true,
				slug: true,
				createdAt: true,
			},
		});

		let emails: unknown[] = [];
		if (input.includeEmails) {
			const rawThreads = await db.emailThread.findMany({
				where: { organizationId: input.organizationId },
				select: {
					id: true,
					subject: true,
					sender: true,
					senderName: true,
					participants: true,
					snippet: true,
					bodyText: true,
					bodyHtml: true,
					receivedAt: true,
					createdAt: true,
					entityId: true,
				},
				orderBy: { receivedAt: "desc" },
			});

			emails = rawThreads.map((t) => {
				const decrypted = decryptEmailContent(t);
				return {
					id: t.id,
					subject: t.subject,
					sender: t.sender,
					senderName: t.senderName,
					participants: t.participants,
					snippet: t.snippet,
					bodyText: decrypted.bodyText,
					receivedAt: t.receivedAt.toISOString(),
					createdAt: t.createdAt.toISOString(),
					entityId: t.entityId,
				};
			});
		}

		let entities: unknown[] = [];
		if (input.includeEntities) {
			const rawEntities = await db.flowEntity.findMany({
				where: { organizationId: input.organizationId },
				select: {
					id: true,
					type: true,
					title: true,
					status: true,
					aiSummary: true,
					extractedFields: true,
					aiConfidence: true,
					requiresReview: true,
					createdAt: true,
					updatedAt: true,
				},
				orderBy: { createdAt: "desc" },
			});

			entities = rawEntities.map((e) => ({
				...e,
				extractedFields: e.extractedFields
					? JSON.parse(e.extractedFields)
					: {},
				createdAt: e.createdAt.toISOString(),
				updatedAt: e.updatedAt.toISOString(),
			}));
		}

		let timeline: unknown[] = [];
		if (input.includeTimeline) {
			timeline = await db.timelineEvent.findMany({
				where: { entity: { organizationId: input.organizationId } },
				select: {
					id: true,
					entityId: true,
					type: true,
					content: true,
					createdAt: true,
				},
				orderBy: { createdAt: "desc" },
				take: 5000,
			});
		}

		const connections = await db.emailConnection.findMany({
			where: { organizationId: input.organizationId },
			select: {
				id: true,
				provider: true,
				email: true,
				authType: true,
				isActive: true,
				lastSyncAt: true,
				createdAt: true,
			},
		});

		const categories = await db.category.findMany({
			where: { organizationId: input.organizationId },
			select: {
				id: true,
				name: true,
				slug: true,
				color: true,
				aiPrompt: true,
				sortOrder: true,
			},
			orderBy: { sortOrder: "asc" },
		});

		writeAuditLog({
			organizationId: input.organizationId,
			userId: context.user.id,
			action: "DATA_EXPORT",
			targetType: "User",
			targetId: context.user.id,
			metadata: {
				includeEmails: input.includeEmails,
				includeEntities: input.includeEntities,
				includeTimeline: input.includeTimeline,
				emailCount: emails.length,
				entityCount: entities.length,
			},
		});

		return {
			exportedAt: new Date().toISOString(),
			format: "json",
			version: "1.0",
			user,
			organization,
			connections: connections.map((c) => ({
				...c,
				lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
				createdAt: c.createdAt.toISOString(),
			})),
			categories,
			emails,
			entities,
			timeline,
		};
	});
