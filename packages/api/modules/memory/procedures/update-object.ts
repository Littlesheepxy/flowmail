import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { updateObjectAttributeSchema } from "../types";

export const updateObjectAttribute = protectedProcedure
	.route({
		method: "PUT",
		path: "/memory/objects/{objectId}/attribute",
		tags: ["Memory"],
		summary: "Update a single attribute of a memory object",
	})
	.input(updateObjectAttributeSchema)
	.handler(async ({ input, context }) => {
		const obj = await db.memoryObject.findUnique({
			where: { id: input.objectId },
		});

		if (!obj) {
			throw new ORPCError("NOT_FOUND", { message: "Memory object not found" });
		}

		await requireOrgMembershipForResource(obj.organizationId, context.user.id);

		const attrs = (obj.attributes ?? {}) as Record<string, unknown>;
		const oldValue = attrs[input.key];
		attrs[input.key] = input.value;

		await db.memoryObject.update({
			where: { id: input.objectId },
			data: {
				attributes: attrs as Record<string, never>,
				lastUpdatedAt: new Date(),
			},
		});

		await db.agentMemory.create({
			data: {
				organizationId: obj.organizationId,
				category: "object_update",
				scope: obj.objectType,
				scopeId: obj.objectId,
				memoryObjectId: obj.id,
				content: `用户手动修改了 ${obj.name} 的 ${input.key}`,
				metadata: JSON.stringify({
					field: input.key,
					oldValue,
					newValue: input.value,
					source: "user_edit",
				}),
				importance: 5,
			},
		});

		return {
			id: obj.id,
			key: input.key,
			value: input.value,
		};
	});
