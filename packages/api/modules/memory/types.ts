import { z } from "zod";

export const listMemoriesSchema = z.object({
	organizationId: z.string(),
	category: z.string().optional(),
	scope: z.string().optional(),
	scopeId: z.string().optional(),
	limit: z.number().min(1).max(100).default(50),
	cursor: z.string().optional(),
});

export const updateMemorySchema = z.object({
	memoryId: z.string(),
	content: z.string().min(1).optional(),
	importance: z.number().min(1).max(10).optional(),
});

export const deleteMemorySchema = z.object({
	memoryId: z.string(),
});

export const getContactProfileSchema = z.object({
	organizationId: z.string(),
	contactEmail: z.string(),
});

// ─── Memory Object schemas ───

export const listObjectsSchema = z.object({
	organizationId: z.string(),
	objectType: z.string().optional(),
	objectId: z.string().optional(),
});

export const getObjectSchema = z.object({
	objectId: z.string(),
});

export const getObjectHistorySchema = z.object({
	objectId: z.string(),
	limit: z.number().min(1).max(50).default(20),
});

export const updateObjectAttributeSchema = z.object({
	objectId: z.string(),
	key: z.string(),
	value: z.unknown(),
});

export const deleteObjectSchema = z.object({
	objectId: z.string(),
});
