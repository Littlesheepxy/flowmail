import { z } from "zod";

export const listPendingApprovalsSchema = z.object({
	organizationId: z.string(),
	assigneeEmail: z.string().email().optional(),
});

export const approveRequestSchema = z.object({
	entityId: z.string(),
	comment: z.string().optional(),
});

export const rejectRequestSchema = z.object({
	entityId: z.string(),
	reason: z.string().min(1),
});
