import {
	createPurchase,
	deletePurchaseBySubscriptionId,
	getPurchaseBySubscriptionId,
	updatePurchase,
} from "@repo/database";
import { logger } from "@repo/logs";
import DodoPayments from "dodopayments";
import { setCustomerIdToEntity } from "../../src/lib/customer";
import type {
	CancelSubscription,
	CreateCheckoutLink,
	CreateCustomerPortalLink,
	SetSubscriptionSeats,
	WebhookHandler,
} from "../../types";

let dodoPaymentsClient: DodoPayments | null = null;

export function getDodoPaymentsClient() {
	if (dodoPaymentsClient) {
		return dodoPaymentsClient;
	}

	const dodoPaymentsApiKey = process.env.DODO_PAYMENTS_API_KEY as string;

	if (!dodoPaymentsApiKey) {
		throw new Error("Missing env variable DODO_PAYMENTS_API_KEY");
	}

	dodoPaymentsClient = new DodoPayments({
		bearerToken: dodoPaymentsApiKey,
		environment:
			process.env.NODE_ENV === "production" ? "live_mode" : "test_mode",
	});

	return dodoPaymentsClient;
}

export const createCheckoutLink: CreateCheckoutLink = async (options) => {
	const client = getDodoPaymentsClient();
	const {
		productId,
		redirectUrl,
		customerId,
		organizationId,
		userId,
		trialPeriodDays,
		seats,
		email,
		name,
	} = options;

	const metadata: Record<string, string> = {};

	if (organizationId) {
		metadata.organization_id = organizationId;
	}

	if (userId) {
		metadata.user_id = userId;
	}

	const response = await client.checkoutSessions.create({
		product_cart: [
			{
				product_id: productId,
				quantity: seats ?? 1,
			},
		],
		return_url: redirectUrl ?? "",
		customer: customerId
			? {
					customer_id: customerId,
				}
			: {
					email: email ?? "",
					name: name ?? "",
				},
		metadata,
		subscription_data: trialPeriodDays
			? {
					trial_period_days: trialPeriodDays,
				}
			: undefined,
	});

	return response.checkout_url;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async ({
	customerId,
}) => {
	const client = getDodoPaymentsClient();

	const response = await client.customers.customerPortal.create(customerId);

	return response.link;
};

export const setSubscriptionSeats: SetSubscriptionSeats = async ({
	id,
	seats,
}) => {
	const client = getDodoPaymentsClient();

	const subscription = await client.subscriptions.retrieve(id);

	if (!subscription) {
		throw new Error("Subscription not found.");
	}

	await client.subscriptions.changePlan(id, {
		product_id: subscription.product_id,
		proration_billing_mode: "prorated_immediately",
		quantity: seats,
	});
};

export const cancelSubscription: CancelSubscription = async (id) => {
	const client = getDodoPaymentsClient();

	await client.subscriptions.update(id, {
		status: "cancelled",
	});
};

export const webhookHandler: WebhookHandler = async (req) => {
	const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET as string;

	if (!webhookSecret) {
		logger.error(
			"Missing DODO_PAYMENTS_WEBHOOK_SECRET environment variable",
		);
		return new Response("Missing webhook secret.", {
			status: 400,
		});
	}

	if (!req.body) {
		return new Response("Invalid request.", {
			status: 400,
		});
	}

	try {
		const body = await req.text();
		const headers = req.headers;

		const webhookId = headers.get("webhook-id");
		const webhookSignature = headers.get("webhook-signature");
		const webhookTimestamp = headers.get("webhook-timestamp");

		if (!webhookId || !webhookSignature || !webhookTimestamp) {
			logger.error("Missing required webhook headers");
			return new Response("Missing webhook headers.", {
				status: 400,
			});
		}

		const payload = `${webhookId}.${webhookTimestamp}.${body}`;
		const crypto = await import("node:crypto");
		const expectedSignature = crypto
			.createHmac("sha256", webhookSecret)
			.update(payload)
			.digest("hex");

		if (webhookSignature !== expectedSignature) {
			logger.error("Invalid webhook signature");
			return new Response("Invalid webhook signature.", {
				status: 401,
			});
		}

		const event = JSON.parse(body);
		const { type, data } = event;

		try {
			switch (type) {
				case "checkout.session.completed": {
					const { metadata, customer, subscription_id, product_id } =
						data;

					if (subscription_id) {
						await createPurchase({
							subscriptionId: subscription_id,
							organizationId: metadata?.organization_id || null,
							userId: metadata?.user_id || null,
							customerId:
								customer?.customer_id || customer?.email,
							type: "SUBSCRIPTION",
							productId: product_id,
							status: "active",
						});

						await setCustomerIdToEntity(
							customer?.customer_id || customer?.email,
							{
								organizationId: metadata?.organization_id,
								userId: metadata?.user_id,
							},
						);
					} else {
						await createPurchase({
							organizationId: metadata?.organization_id || null,
							userId: metadata?.user_id || null,
							customerId:
								customer?.customer_id || customer?.email,
							type: "ONE_TIME",
							productId: product_id,
						});

						await setCustomerIdToEntity(
							customer?.customer_id || customer?.email,
							{
								organizationId: metadata?.organization_id,
								userId: metadata?.user_id,
							},
						);
					}
					break;
				}

				case "subscription.created": {
					const {
						metadata,
						customer,
						subscription_id,
						product_id,
						status,
					} = data;

					await createPurchase({
						subscriptionId: subscription_id,
						organizationId: metadata?.organization_id || null,
						userId: metadata?.user_id || null,
						customerId: customer?.customer_id || customer?.email,
						type: "SUBSCRIPTION",
						productId: product_id,
						status: status || "active",
					});

					await setCustomerIdToEntity(
						customer?.customer_id || customer?.email,
						{
							organizationId: metadata?.organization_id,
							userId: metadata?.user_id,
						},
					);
					break;
				}

				case "subscription.updated": {
					const { subscription_id, status, product_id } = data;

					const existingPurchase =
						await getPurchaseBySubscriptionId(subscription_id);

					if (existingPurchase) {
						await updatePurchase({
							id: existingPurchase.id,
							status: status,
							productId: product_id,
						});
					}
					break;
				}

				case "subscription.cancelled": {
					await deletePurchaseBySubscriptionId(data.subscription_id);
					break;
				}

				default:
					logger.info(`Unhandled webhook event type: ${type}`);
					return new Response("Unhandled event type.", {
						status: 200,
					});
			}

			return new Response(null, { status: 204 });
		} catch (error) {
			logger.error("Error processing webhook event", {
				error: error instanceof Error ? error.message : error,
				eventType: type,
				webhookId,
			});

			return new Response(
				`Webhook error: ${error instanceof Error ? error.message : ""}`,
				{
					status: 400,
				},
			);
		}
	} catch (error) {
		logger.error("Error processing webhook", {
			error: error instanceof Error ? error.message : error,
		});

		return new Response("Invalid webhook payload.", {
			status: 400,
		});
	}
};
