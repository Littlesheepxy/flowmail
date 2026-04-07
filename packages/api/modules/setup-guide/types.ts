import { z } from "zod";

export const setupGuideStatusSchema = z.object({
	organizationId: z.string(),
});

export const markStepSchema = z.object({
	organizationId: z.string(),
	step: z.enum(["tourCompleted", "notificationChecked"]),
});

export const dismissGuideSchema = z.object({
	organizationId: z.string(),
});

export type SetupGuideStatusInput = z.infer<typeof setupGuideStatusSchema>;
export type MarkStepInput = z.infer<typeof markStepSchema>;
export type DismissGuideInput = z.infer<typeof dismissGuideSchema>;

export interface SetupGuideMetadata {
	tourCompleted?: boolean;
	dismissed?: boolean;
	notificationChecked?: boolean;
}

export interface SetupGuideStatus {
	tourCompleted: boolean;
	dismissed: boolean;
	steps: {
		connectEmail: boolean;
		configureCategories: boolean;
		processFirstEmail: boolean;
		checkNotifications: boolean;
	};
	completedCount: number;
	totalSteps: number;
}
