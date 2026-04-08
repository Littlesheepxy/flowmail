import { db } from "@repo/database";
import { createHash } from "node:crypto";

const INBOUND_DOMAIN =
	process.env.INBOUND_EMAIL_DOMAIN || "inbound.flowmail.ai";

function generateShortId(orgId: string): string {
	const hash = createHash("sha256").update(orgId).digest("hex");
	return hash.slice(0, 8);
}

export async function getOrCreateInboundAddress(
	organizationId: string,
): Promise<{ address: string; shortId: string }> {
	const org = await db.organization.findUnique({
		where: { id: organizationId },
		select: {
			inboundEmailAddress: true,
			inboundEmailShortId: true,
		},
	});

	if (org?.inboundEmailAddress && org.inboundEmailShortId) {
		return {
			address: org.inboundEmailAddress,
			shortId: org.inboundEmailShortId,
		};
	}

	let shortId = generateShortId(organizationId);
	let address = `inbox-${shortId}@${INBOUND_DOMAIN}`;

	const existing = await db.organization.findUnique({
		where: { inboundEmailShortId: shortId },
	});
	if (existing && existing.id !== organizationId) {
		shortId = generateShortId(`${organizationId}-${Date.now()}`);
		address = `inbox-${shortId}@${INBOUND_DOMAIN}`;
	}

	await db.organization.update({
		where: { id: organizationId },
		data: {
			inboundEmailShortId: shortId,
			inboundEmailAddress: address,
		},
	});

	return { address, shortId };
}

export async function resolveOrganizationByInboundAddress(
	toAddress: string,
): Promise<string | null> {
	const match = toAddress.match(/^inbox-([a-f0-9]+)@/i);
	if (!match) {
		return null;
	}

	const shortId = match[1];
	const org = await db.organization.findUnique({
		where: { inboundEmailShortId: shortId },
		select: { id: true },
	});

	return org?.id ?? null;
}
