/**
 * Migration script: encrypt existing EmailThread bodyText/bodyHtml/rawPayload fields.
 *
 * Usage:
 *   npx tsx packages/database/prisma/scripts/encrypt-email-bodies.ts
 *
 * Requires FIELD_ENCRYPTION_KEY and DATABASE_URL in environment.
 */
import { PrismaClient } from "@prisma/client";
import { encryptField, isEncrypted } from "../lib/encryption";

const BATCH_SIZE = 100;
const FIELDS_TO_ENCRYPT = ["bodyText", "bodyHtml", "rawPayload"] as const;

async function main() {
	const prisma = new PrismaClient();

	try {
		const totalCount = await prisma.emailThread.count();
		console.log(`Found ${totalCount} email threads to process`);

		let processed = 0;
		let encrypted = 0;
		let skipped = 0;
		let cursor: string | undefined;

		while (true) {
			const threads = await prisma.emailThread.findMany({
				take: BATCH_SIZE,
				...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
				orderBy: { id: "asc" },
				select: {
					id: true,
					bodyText: true,
					bodyHtml: true,
					rawPayload: true,
				},
			});

			if (threads.length === 0) {
				break;
			}

			for (const thread of threads) {
				const updates: Record<string, string> = {};

				for (const field of FIELDS_TO_ENCRYPT) {
					const value = thread[field];
					if (value && !isEncrypted(value)) {
						updates[field] = encryptField(value);
					}
				}

				if (Object.keys(updates).length > 0) {
					await prisma.emailThread.update({
						where: { id: thread.id },
						data: updates,
					});
					encrypted++;
				} else {
					skipped++;
				}

				processed++;
			}

			cursor = threads[threads.length - 1].id;
			console.log(
				`Progress: ${processed}/${totalCount} (encrypted: ${encrypted}, skipped: ${skipped})`,
			);
		}

		console.log(
			`\nDone! Processed: ${processed}, Encrypted: ${encrypted}, Skipped: ${skipped}`,
		);
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((err) => {
	console.error("Migration failed:", err);
	process.exit(1);
});
