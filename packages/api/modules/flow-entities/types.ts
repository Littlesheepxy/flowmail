import { z } from "zod";

export const entityTypeSchema = z.enum(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK"]);

export const listEntitiesSchema = z.object({
	organizationId: z.string(),
	type: entityTypeSchema.optional(),
	categoryId: z.string().optional(),
	categorySlug: z.string().optional(),
	status: z.string().optional(),
	limit: z.number().int().min(1).max(100).optional().default(50),
	offset: z.number().int().min(0).optional().default(0),
});

export const getEntitySchema = z.object({
	entityId: z.string(),
});

export const updateEntityStatusSchema = z.object({
	entityId: z.string(),
	status: z.string(),
	reason: z.string().optional(),
});

export type ListEntitiesInput = z.infer<typeof listEntitiesSchema>;
export type GetEntityInput = z.infer<typeof getEntitySchema>;
export type UpdateEntityStatusInput = z.infer<typeof updateEntityStatusSchema>;
