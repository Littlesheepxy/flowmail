import { z } from "zod";

export const listTagsSchema = z.object({
	organizationId: z.string(),
});

export const createTagSchema = z.object({
	organizationId: z.string(),
	name: z.string().min(1).max(50),
	color: z.string().optional(),
});

export const addTagToEntitySchema = z.object({
	entityId: z.string(),
	tagId: z.string().optional(),
	tagName: z.string().optional(),
});

export const removeTagFromEntitySchema = z.object({
	entityId: z.string(),
	tagId: z.string(),
});

export const deleteTagSchema = z.object({
	tagId: z.string(),
});
