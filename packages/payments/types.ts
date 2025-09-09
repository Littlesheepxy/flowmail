export type CreateCheckoutLink = (params: {
	type: "subscription" | "one-time";
	productId: string;
	email?: string;
	name?: string;
	redirectUrl?: string;
	customerId?: string;
	organizationId?: string;
	userId?: string;
	trialPeriodDays?: number;
	seats?: number;
}) => Promise<string | null>;

export type CreateCustomerPortalLink = (params: {
	subscriptionId?: string;
	customerId: string;
	redirectUrl?: string;
}) => Promise<string | null>;

export type SetSubscriptionSeats = (params: {
	id: string;
	seats: number;
}) => Promise<void>;

export type CancelSubscription = (id: string) => Promise<void>;

export type WebhookHandler = (req: Request) => Promise<Response>;

export type PaymentProvider = {
	createCheckoutLink: CreateCheckoutLink;
	createCustomerPortalLink: CreateCustomerPortalLink;
	webhookHandler: WebhookHandler;
};
