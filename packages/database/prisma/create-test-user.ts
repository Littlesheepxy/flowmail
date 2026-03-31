import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";
import { hashPassword } from "better-auth/crypto";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set. Run with: dotenv -e ../../.env.local -- tsx prisma/create-test-user.ts");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
	const email = "test@flowmail.dev";
	const password = "Test123456!";
	const hashedPassword = await hashPassword(password);
	const now = new Date();

	const existingUser = await db.user.findFirst({ where: { email } });
	if (existingUser) {
		console.log(`User ${email} already exists, deleting and recreating...`);
		await db.account.deleteMany({ where: { userId: existingUser.id } });
		await db.session.deleteMany({ where: { userId: existingUser.id } });
		await db.member.deleteMany({ where: { userId: existingUser.id } });
		await db.user.delete({ where: { id: existingUser.id } });
	}

	const user = await db.user.create({
		data: {
			name: "Test User",
			email,
			emailVerified: true,
			onboardingComplete: false,
			createdAt: now,
			updatedAt: now,
		},
	});

	await db.account.create({
		data: {
			accountId: user.id,
			providerId: "credential",
			userId: user.id,
			password: hashedPassword,
			createdAt: now,
			updatedAt: now,
		},
	});

	console.log("✅ Test user created!");
	console.log(`   Email:    ${email}`);
	console.log(`   Password: ${password}`);
}

main()
	.catch((e) => {
		console.error("Failed:", e);
		process.exit(1);
	})
	.finally(() => db.$disconnect());
