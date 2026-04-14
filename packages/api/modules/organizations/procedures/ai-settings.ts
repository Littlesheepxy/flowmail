import { db } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyOrganizationMembership } from "../lib/membership";

interface OrgMetadata {
	autoAiAnalysis?: boolean;
	[key: string]: unknown;
}

function parseMetadata(raw: string | null): OrgMetadata {
	if (!raw) {
		return {};
	}
	try {
		return JSON.parse(raw) as OrgMetadata;
	} catch {
		return {};
	}
}

export const getAiSettings = protectedProcedure
	.route({
		method: "GET",
		path: "/organizations/{organizationId}/ai-settings",
		tags: ["Organizations"],
		summary: "Get organization AI settings",
	})
	.input(z.object({ organizationId: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyOrganizationMembership(input.organizationId, context.user.id);

		const org = await db.organization.findUnique({
			where: { id: input.organizationId },
			select: { metadata: true },
		});

		const meta = parseMetadata(org?.metadata ?? null);
		return {
			autoAiAnalysis: meta.autoAiAnalysis ?? false,
		};
	});

export const updateAiSettings = protectedProcedure
	.route({
		method: "POST",
		path: "/organizations/{organizationId}/ai-settings",
		tags: ["Organizations"],
		summary: "Update organization AI settings",
	})
	.input(z.object({
		organizationId: z.string(),
		autoAiAnalysis: z.boolean(),
	}))
	.handler(async ({ input, context }) => {
		await verifyOrganizationMembership(input.organizationId, context.user.id);

		const org = await db.organization.findUnique({
			where: { id: input.organizationId },
			select: { metadata: true },
		});

		const meta = parseMetadata(org?.metadata ?? null);
		meta.autoAiAnalysis = input.autoAiAnalysis;

		await db.organization.update({
			where: { id: input.organizationId },
			data: { metadata: JSON.stringify(meta) },
		});

		return { autoAiAnalysis: input.autoAiAnalysis };
	});
