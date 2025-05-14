import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
	return new PrismaClient();
};

declare global {
	var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

// biome-ignore lint/suspicious/noRedeclare: <explanation>
const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
	globalThis.prisma = prisma;
}

export { prisma as db };
