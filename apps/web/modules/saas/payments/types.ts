import type { config } from "@repo/config";

export type PlanId = keyof typeof config.payments.plans;
