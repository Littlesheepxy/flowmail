import { createHmac } from "node:crypto";
import {
	createPurchase,
	deletePurchaseBySubscriptionId,
	getPurchaseBySubscriptionId,
	updatePurchase,
} from "@repo/database";
import { logger } from "@repo/logs";
import { joinURL } from "ufo";
import type {
	CancelSubscription,
	CreateCheckoutLink,
	CreateCustomerPortalLink,
	SetSubscriptionSeats,
	WebhookHandler,
} from "../../types";

export function creemFetch(path: string, init: Parameters<typeof fetch>[1]) {
	const creemApiKey = process.env.CREEM_API_KEY as string;

	if (!creemApiKey) {
		throw new Error("Missing env variable CREEM_API_KEY");
	}

	const baseUrl =
		process.env.NODE_ENV === "production"
			? "https://api.creem.io/v1"
			: "https://test-api.creem.io/v1";

	const requestUrl = joinURL(baseUrl, path);

	return fetch(requestUrl, {
		...init,
		headers: {
			"x-api-key": creemApiKey,
			"Content-Type": "application/json",
		},
	});
}

export const createCheckoutLink: CreateCheckoutLink = async (options) => {
	const { productId, redirectUrl, organizationId, userId, seats, email } =
		options;

	const response = await creemFetch("/checkouts", {
		method: "POST",
		body: JSON.stringify({
			product_id: productId,
			units: seats ?? 1,
			success_url: redirectUrl ?? undefined,
			metadata: {
				organization_id: organizationId || null,
				user_id: userId || null,
			},
			customer: {
				email,
			},
		}),
	});

	if (!response.ok) {
		logger.error("Failed to create checkout link", await response.json());
		throw new Error("Failed to create checkout link");
	}

	const { checkout_url } = await response.json();

	return checkout_url;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async ({
	customerId,
}) => {
	const response = await creemFetch("/customers/billing", {
		method: "POST",
		body: JSON.stringify({
			customer_id: customerId,
		}),
	});

	const { customer_portal_link } = await response.json();

	return customer_portal_link;
};

export const setSubscriptionSeats: SetSubscriptionSeats = async ({
	id,
	seats,
}) => {
	const response = await creemFetch(`/subscriptions?subscription_id=${id}`, {
		method: "GET",
	});

	const { items } = await response.json();

	await creemFetch(`/subscriptions/${id}`, {
		method: "POST",
		body: JSON.stringify({
			items: [
				{
					id: items[0].id,
					quantity: seats,
				},
			],
		}),
	});
};

export const cancelSubscription: CancelSubscription = async (id) => {
	await creemFetch(`/subscriptions/${id}/cancel`, {
		method: "POST",
	});
};

export const webhookHandler: WebhookHandler = async (req) => {
	if (req.method !== "POST") {
		return new Response("Method not allowed.", {
			status: 405,
		});
	}

	const signature = req.headers.get("creem-signature");

	if (!signature) {
		return new Response("Missing signature.", {
			status: 400,
		});
	}

	const secret = process.env.CREEM_WEBHOOK_SECRET as string;

	if (!secret) {
		return new Response("Missing webhook secret.", {
			status: 400,
		});
	}

	const bodyText = await req.text();

	const computedSignature = createHmac("sha256", secret)
		.update(bodyText)
		.digest("hex");

	if (computedSignature !== signature) {
		return new Response("Invalid signature.", {
			status: 400,
		});
	}

	const payload = JSON.parse(bodyText);

	try {
		switch (payload.eventType) {
			case "checkout.completed": {
				const { product, metadata, object, customer } = payload.object;
				if (!product?.id) {
					return new Response("Missing product ID.", {
						status: 400,
					});
				}

				if (object === "subscription") {
					break;
				}

				await createPurchase({
					organizationId: metadata?.organization_id || null,
					userId: metadata?.user_id || null,
					customerId: customer as string,
					type: "ONE_TIME",
					productId: product.id,
				});

				break;
			}
			case "subscription.active": {
				const { id, customer, product, metadata } = payload.object;
				const existingPurchase = await getPurchaseBySubscriptionId(id);

				if (existingPurchase) {
					await updatePurchase({
						id: existingPurchase.id,
						status: product.status,
						productId: product.id,
					});
					break;
				}

				await createPurchase({
					subscriptionId: id,
					customerId: customer.id,
					type: "SUBSCRIPTION",
					productId: product.id,
					organizationId: metadata?.organization_id || null,
					userId: metadata?.user_id || null,
				});

				break;
			}
			case "subscription.canceled":
			case "subscription.expired": {
				const { id } = payload.object;
				await deletePurchaseBySubscriptionId(id);
				break;
			}
			default:
				return new Response("Unhandled event type.", {
					status: 200,
				});
		}
		return new Response(null, { status: 204 });
	} catch (error) {
		return new Response(
			`Webhook error: ${error instanceof Error ? error.message : ""}`,
			{
				status: 400,
			},
		);
	}
};
