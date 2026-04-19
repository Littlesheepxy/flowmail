import { z } from "zod";

export const entityTypeSchema = z.enum(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK", "NOISE"]);

export const listEntitiesSchema = z.object({
	organizationId: z.string(),
	type: entityTypeSchema.optional(),
	categoryId: z.string().optional(),
	categorySlug: z.string().optional(),
	status: z.string().optional(),
	includeFiltered: z.boolean().optional().default(false),
	limit: z.number().int().min(1).max(100).optional().default(50),
	offset: z.number().int().min(0).optional().default(0),
});

export const getEntitySchema = z.object({
	entityId: z.string(),
	// 默认 false：首屏不返回 bodyHtml/bodyText（一封邮件可能含 base64 图片，9 封 = 1.7MB），
	// 只用 snippet/sender/subject。需要原文时（ThreadChatView）传 true 走完整 payload。
	includeBodies: z.boolean().optional().default(false),
});

export const updateEntityStatusSchema = z.object({
	entityId: z.string(),
	status: z.string(),
	reason: z.string().optional(),
});

export const renameEntitySchema = z.object({
	entityId: z.string(),
	title: z.string().min(1).max(200).describe("新标题，1-200 字"),
});

export const submitFeedbackSchema = z.object({
	entityId: z.string(),
	feedbackType: z.enum(["thumbs_up", "thumbs_down"]),
	target: z.enum(["classification", "suggestion", "agent_action"]),
	correction: z.string().optional(),
	comment: z.string().optional(),
});

export const mergeEntitiesSchema = z.object({
	targetEntityId: z.string(),
	sourceEntityId: z.string(),
});

export const splitEntitySchema = z.object({
	entityId: z.string(),
	threadIds: z.array(z.string()).min(1),
});

export const reclassifyEntitySchema = z.object({
	entityId: z.string(),
	type: entityTypeSchema,
	categorySlug: z.string().optional(),
});

export type ListEntitiesInput = z.infer<typeof listEntitiesSchema>;
export type GetEntityInput = z.infer<typeof getEntitySchema>;
export type UpdateEntityStatusInput = z.infer<typeof updateEntityStatusSchema>;
export type RenameEntityInput = z.infer<typeof renameEntitySchema>;
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
export type MergeEntitiesInput = z.infer<typeof mergeEntitiesSchema>;
export type SplitEntityInput = z.infer<typeof splitEntitySchema>;
export type ReclassifyEntityInput = z.infer<typeof reclassifyEntitySchema>;
