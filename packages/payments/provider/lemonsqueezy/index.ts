import { createHmac, timingSafeEqual } from "node:crypto";
import {
	cancelSubscription as cancelSubscriptionResolver,
	createCheckout,
	getCustomer,
	getSubscription,
	lemonSqueezySetup,
	updateSubscriptionItem,
} from "@lemonsqueezy/lemonsqueezy.js";
import {
	createPurchase,
	deletePurchaseBySubscriptionId,
	getPurchaseBySubscriptionId,
	updatePurchase,
} from "@repo/database";
import { setCustomerIdToEntity } from "../../src/lib/customer";
import type {
	CancelSubscription,
	CreateCheckoutLink,
	CreateCustomerPortalLink,
	SetSubscriptionSeats,
	WebhookHandler,
} from "../../types";

function initLemonsqueezyApi() {
	lemonSqueezySetup({
		apiKey: process.env.LEMONSQUEEZY_API_KEY as string,
	});
}

export const createCheckoutLink: CreateCheckoutLink = async (options) => {
	initLemonsqueezyApi();

	const { seats, productId, redirectUrl, email, name } = options;

	const response = await createCheckout(
		String(process.env.LEMONSQUEEZY_STORE_ID),
		productId,
		{
			productOptions: {
				redirectUrl,
				enabledVariants: [Number.parseInt(productId, 10)],
			},
			checkoutData: {
				email,
				name,
				variantQuantities: [
					{
						variantId: Number.parseInt(productId, 10),
						quantity: seats ?? 1,
					},
				],
				custom:
					"organizationId" in options
						? {
								organization_id: options.organizationId,
							}
						: {
								user_id: options.userId,
							},
			},
		},
	);

	return response.data?.data.attributes.url ?? null;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async ({
	customerId,
}) => {
	initLemonsqueezyApi();

	const response = await getCustomer(customerId);

	return response.data?.data.attributes.urls.customer_portal ?? null;
};

export const setSubscriptionSeats: SetSubscriptionSeats = async ({
	id,
	seats,
}) => {
	initLemonsqueezyApi();

	const subscription = await getSubscription(id, {
		include: ["subscription-items"],
	});

	if (!subscription) {
		throw new Error("Subscription not found.");
	}

	const subscriptionItem =
		subscription.data?.data.relationships["subscription-items"].data?.[0];

	if (!subscriptionItem) {
		throw new Error("Subscription item not found.");
	}

	await updateSubscriptionItem(subscriptionItem.id, {
		quantity: seats,
	});
};

export const cancelSubscription: CancelSubscription = async (id) => {
	initLemonsqueezyApi();

	await cancelSubscriptionResolver(id);
};

export const webhookHandler: WebhookHandler = async (req: Request) => {
	try {
		const text = await req.text();
		const hmac = createHmac(
			"sha256",
			process.env.LEMONSQUEEZY_WEBHOOK_SECRET as string,
		);
		const digest = Buffer.from(hmac.update(text).digest("hex"), "utf8");
		const signature = Buffer.from(
			req.headers.get("x-signature") as string,
			"utf8",
		);

		if (!timingSafeEqual(digest, signature)) {
			return new Response("Invalid signature.", {
				status: 400,
			});
		}

		const payload = JSON.parse(text) as {
			meta: {
				event_name: string;
				custom_data: {
					organization_id?: string;
					user_id?: string;
				};
			};
			data: {
				id: string;
				attributes: {
					customer_id: string;
					product_id: string;
					variant_id: string;
					status: string;
					trial_ends_at?: number;
					renews_at?: number;
				};
			};
		} | null;

		if (!payload) {
			return new Response("Invalid payload.", {
				status: 400,
			});
		}

		const {
			meta: { event_name: eventName, custom_data: customData },
			data,
		} = payload;

		const id = String(data.id);

		switch (eventName) {
			case "subscription_created": {
				await createPurchase({
					organizationId: customData.organization_id,
					userId: customData.user_id,
					subscriptionId: id,
					customerId: String(data.attributes.customer_id),
					productId: String(data.attributes.variant_id),
					status: data.attributes.status,
					type: "SUBSCRIPTION",
				});

				await setCustomerIdToEntity(
					String(data.attributes.customer_id),
					{
						organizationId: customData.organization_id,
						userId: customData.user_id,
					},
				);

				break;
			}
			case "subscription_updated":
			case "subscription_cancelled":
			case "subscription_resumed": {
				const subscriptionId = String(data.id);

				const existingPurchase =
					await getPurchaseBySubscriptionId(subscriptionId);

				if (existingPurchase) {
					await updatePurchase({
						id: existingPurchase.id,
						status: data.attributes.status,
					});
				}

				break;
			}

			case "subscription_expired": {
				const subscriptionId = String(data.id);

				await deletePurchaseBySubscriptionId(subscriptionId);

				break;
			}
			case "order_created": {
				await createPurchase({
					organizationId: customData.organization_id,
					userId: customData.user_id,
					customerId: String(data.attributes.customer_id),
					productId: String(data.attributes.product_id),
					type: "ONE_TIME",
				});

				await setCustomerIdToEntity(
					String(data.attributes.customer_id),
					{
						organizationId: customData.organization_id,
						userId: customData.user_id,
					},
				);

				break;
			}

			default: {
				return new Response("Unhandled event type.", {
					status: 200,
				});
			}
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
