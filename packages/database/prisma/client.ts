import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>;

declare global {
	var prisma: undefined | PrismaClientSingleton;
}

function createPrismaClient() {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not set");
	}

	const adapter = new PrismaPg({
		connectionString: process.env.DATABASE_URL,
		max: 10, // limit connection pool to prevent "too many clients" error
	});

	return new PrismaClient({ adapter });
}

function getDb() {
	// biome-ignore lint/suspicious/noRedeclare: This is a singleton
	globalThis.prisma ??= createPrismaClient();
	return globalThis.prisma;
}

export const db = new Proxy({} as PrismaClientSingleton, {
	get(_target, prop) {
		return getDb()[prop as keyof PrismaClientSingleton];
	},
});
