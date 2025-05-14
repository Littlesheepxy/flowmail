import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: "./drizzle/schema/postgres.ts",
	dbCredentials: {
		url: process.env.DATABASE_URL as string,
	},
});
