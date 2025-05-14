import {
	createPurchase,
	getPurchaseBySubscriptionId,
	updatePurchase,
} from "@repo/database";
import { ChargeBee } from "chargebee-typescript";
import type {
	CreateCheckoutLink,
	CreateCustomerPortalLink,
	WebhookHandler,
} from "../../types";

let chargebeeClient: ChargeBee | null = null;

export function getChargebeeClient() {
	if (chargebeeClient) {
		return chargebeeClient;
	}

	const chargebeeSite = process.env.CHARGEBEE_SITE as string;
	const chargebeeApiKey = process.env.CHARGEBEE_API_KEY as string;

	if (!chargebeeSite) {
		throw new Error("Missing env variable CHARGEBEE_SITE");
	}

	if (!chargebeeApiKey) {
		throw new Error("Missing env variable CHARGEBEE_API_KEY");
	}

	chargebeeClient = new ChargeBee();

	chargebeeClient.configure({
		site: chargebeeSite,
		api_key: chargebeeApiKey,
	});

	return chargebeeClient;
}

export const createCheckoutLink: CreateCheckoutLink = async (options) => {
	// splitting name into first & last names, possible to go wrong in some cases
	//  but Chargebee Checkout lets users edit the info before completing the checkout
	const { productId, redirectUrl, email, name } = options;
	const [firstName, lastName] = name ? name.split(" ") : ["", ""];
	const chargebeeClient = getChargebeeClient();

	const response = await chargebeeClient.hosted_page
		.checkout_new_for_items({
			subscription_items: [
				{
					item_price_id: productId,
				},
			],
			subscription:
				"organizationId" in options
					? {
							// @ts-ignore
							cf_organization_id: options.organizationId,
						}
					: {
							// @ts-ignore
							cf_user_id: options.userId,
						},
			customer: {
				email,
				first_name: firstName,
				last_name: lastName,
			},
			billing_address: {
				email,
				first_name: firstName,
				last_name: lastName,
			},
			redirect_url: redirectUrl,
		})
		.request();

	return response.hosted_page.url;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async ({
	customerId,
	redirectUrl,
}) => {
	const chargebeeClient = getChargebeeClient();

	const response = await chargebeeClient.portal_session
		.create({
			customer: {
				id: customerId,
			},
			redirect_url: redirectUrl,
		})
		.request();

	return response.portal_session.access_url;
};

export const webhookHandler: WebhookHandler = async (req: Request) => {
	try {
		const payload = (await req.json()) as {
			event_type: string;
			content: {
				subscription: {
					id: string;
					status: string;
					trial_end: number;
					current_term_end: number;
					next_billing_at: number;
					subscription_items: {
						item_price_id: string;
					}[];
				} & (
					| {
							cf_organization_id: string;
					  }
					| {
							cf_user_id: string;
					  }
				);
				customer: {
					id: string;
				};
			};
		} | null;

		const type = payload?.event_type ?? null;

		if (
			!(
				type &&
				[
					"subscription_created",
					"subscription_cancelled",
					"subscription_changed",
				].includes(type)
			)
		) {
			return new Response("Invalid event type.", {
				status: 400,
			});
		}

		const data = payload?.content;

		if (!data) {
			throw new Error("Invalid payload.");
		}

		const id = String(data.subscription.id);

		if ("cf_organization_id" in data.subscription) {
			const existingPurchase = await getPurchaseBySubscriptionId(id);

			if (existingPurchase) {
				await updatePurchase({
					id: existingPurchase.id,
					status: data.subscription.status,
				});
			} else {
				await createPurchase({
					id,
					organizationId: data.subscription.cf_organization_id,
					customerId: data.customer.id,
					productId:
						data.subscription.subscription_items[0].item_price_id,
					status: data.subscription.status,
					type: "SUBSCRIPTION",
				});
			}
		} else {
			const existingPurchase = await getPurchaseBySubscriptionId(id);

			if (existingPurchase) {
				await updatePurchase({
					id: existingPurchase.id,
					status: data.subscription.status,
				});
			} else {
				await createPurchase({
					id,
					userId: data.subscription.cf_user_id,
					customerId: data.customer.id,
					productId:
						data.subscription.subscription_items[0].item_price_id,
					status: data.subscription.status,
					type: "SUBSCRIPTION",
				});
			}
		}
	} catch (error: unknown) {
		return new Response(
			`Webhook error: ${error instanceof Error ? error.message : ""}`,
			{
				status: 400,
			},
		);
	}

	return new Response(null, {
		status: 204,
	});
};
