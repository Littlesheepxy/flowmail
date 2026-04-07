import { createHash, randomBytes } from "node:crypto";
import { db } from "@repo/database";

const TOKEN_PREFIX = "fm_";

export function generateRawToken(): string {
	const bytes = randomBytes(32);
	return `${TOKEN_PREFIX}${bytes.toString("hex")}`;
}

export function hashToken(rawToken: string): string {
	return createHash("sha256").update(rawToken).digest("hex");
}

export function extractPrefix(rawToken: string): string {
	return `${rawToken.slice(0, 7)}...${rawToken.slice(-4)}`;
}

export async function verifyApiToken(bearerToken: string) {
	const hash = hashToken(bearerToken);

	const token = await db.apiToken.findUnique({
		where: { tokenHash: hash },
		select: {
			id: true,
			organizationId: true,
			scopes: true,
			isActive: true,
			expiresAt: true,
		},
	});

	if (!token) {
		return null;
	}

	if (!token.isActive) {
		return null;
	}

	if (token.expiresAt && token.expiresAt < new Date()) {
		return null;
	}

	await db.apiToken.update({
		where: { id: token.id },
		data: { lastUsedAt: new Date() },
	});

	return {
		tokenId: token.id,
		organizationId: token.organizationId,
		scopes: token.scopes.split(","),
	};
}
