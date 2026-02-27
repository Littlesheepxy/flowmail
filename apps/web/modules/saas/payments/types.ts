import type { config } from "@repo/payments/config";

export type PlanId = keyof typeof config.plans;
