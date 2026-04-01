import { z } from "zod/v4";

export const listNotificationsSchema = z.object({
	organizationId: z.string(),
	limit: z.number().default(20),
	cursor: z.string().optional(),
	unreadOnly: z.boolean().default(false),
});

export const markReadSchema = z.object({
	notificationId: z.string().optional(),
	organizationId: z.string(),
	markAll: z.boolean().default(false),
});

export const getUnreadCountSchema = z.object({
	organizationId: z.string(),
});
