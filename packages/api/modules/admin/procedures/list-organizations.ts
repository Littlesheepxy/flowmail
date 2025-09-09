import { ORPCError } from "@orpc/client";
import {
	countAllOrganizations,
	getOrganizationById as getOrganizationByIdFn,
	getOrganizations,
} from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const listOrganizations = adminProcedure
	.route({
		method: "GET",
		path: "/admin/organizations",
		tags: ["Administration"],
		summary: "List organizations",
	})
	.input(
		z.object({
			query: z.string().optional(),
			limit: z.number().min(1).max(100).default(10),
			offset: z.number().min(0).default(0),
		}),
	)
	.handler(async ({ input: { query, limit, offset } }) => {
		const organizations = await getOrganizations({
			limit,
			offset,
			query,
		});

		const total = await countAllOrganizations();

		return { organizations, total };
	});

export const getOrganizationById = adminProcedure
	.route({
		method: "GET",
		path: "/admin/organizations/{id}",
		tags: ["Administration"],
	})
	.input(
		z.object({
			id: z.string(),
		}),
	)
	.handler(async ({ input: { id } }) => {
		const organization = await getOrganizationByIdFn(id);

		if (!organization) {
			throw new ORPCError("NOT_FOUND");
		}

		return organization;
	});
