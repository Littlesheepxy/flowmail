import { countAllUsers, getUsers } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const listUsers = adminProcedure
	.route({
		method: "GET",
		path: "/admin/users",
		tags: ["Administration"],
		summary: "List users",
	})
	.input(
		z.object({
			query: z.string().optional(),
			limit: z.number().min(1).max(100).default(10),
			offset: z.number().min(0).default(0),
		}),
	)
	.handler(async ({ input: { query, limit, offset } }) => {
		const users = await getUsers({
			limit,
			offset,
			query,
		});

		const total = await countAllUsers();

		return { users, total };
	});
