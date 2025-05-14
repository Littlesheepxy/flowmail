import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema/postgres";

// Check the drizzle documentation for more information on how to connect to your preferred database provider
// https://orm.drizzle.team/docs/get-started-postgresql

const databaseUrl = process.env.DATABASE_URL as string;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is not set");
}

export const db = drizzle(databaseUrl, {
	schema,
});
