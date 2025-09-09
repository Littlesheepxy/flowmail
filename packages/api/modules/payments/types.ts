import { z } from "zod";

export const SubscriptionPlanVariantModel = z.object({
	id: z.string(),
	price: z.number(),
	currency: z.string(),
	interval: z.string(),
	interval_count: z.number(),
});

export const SubscriptionPlanModel = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	storeId: z.string().nullable().optional(),
	variants: z.array(SubscriptionPlanVariantModel),
});

export type SubscriptionPlan = z.infer<typeof SubscriptionPlanModel>;
export type SubscriptionPlanVariant = z.infer<
	typeof SubscriptionPlanVariantModel
>;
