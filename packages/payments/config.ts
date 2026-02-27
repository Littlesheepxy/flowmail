export const config = {
	billingAttachedTo: "user" as "user" | "organization", // 'users' or 'organizations'
	plans: {
		// The free plan is treated differently. It will automatically be assigned if the user has no other plan.
		free: {
			isFree: true,
		},
		pro: {
			recommended: true,
			prices: [
				{
					type: "recurring",
					productId: process.env
						.NEXT_PUBLIC_PRICE_ID_PRO_MONTHLY as string,
					interval: "month",
					amount: 29,
					currency: "USD",
					seatBased: true,
					trialPeriodDays: 7,
				},
				{
					type: "recurring",
					productId: process.env
						.NEXT_PUBLIC_PRICE_ID_PRO_YEARLY as string,
					interval: "year",
					amount: 290,
					currency: "USD",
					seatBased: true,
					trialPeriodDays: 7,
				},
			],
		},
		lifetime: {
			prices: [
				{
					type: "one-time",
					productId: process.env
						.NEXT_PUBLIC_PRICE_ID_LIFETIME as string,
					amount: 799,
					currency: "USD",
				},
			],
		},
		enterprise: {
			isEnterprise: true,
		},
	},
} as const;
