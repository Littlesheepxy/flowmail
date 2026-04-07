import { z } from "zod";

export const listCategoriesSchema = z.object({
	organizationId: z.string(),
});

export const createCategorySchema = z.object({
	organizationId: z.string(),
	name: z.string().min(1).max(50),
	slug: z
		.string()
		.min(1)
		.max(50)
		.regex(/^[a-z0-9-]+$/),
	icon: z.string().default("InboxIcon"),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
	aiPrompt: z.string().max(2000).default(""),
});

export const updateCategorySchema = z.object({
	id: z.string(),
	name: z.string().min(1).max(50).optional(),
	icon: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	aiPrompt: z.string().max(2000).optional(),
});

export const deleteCategorySchema = z.object({
	id: z.string(),
	organizationId: z.string(),
});

export const reorderCategoriesSchema = z.object({
	organizationId: z.string(),
	orderedIds: z.array(z.string()).min(1),
});

export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
