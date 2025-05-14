import { auth } from "@repo/auth";
import { trackUsage } from "@repo/payments/src/lib/usage";

export async function POST(req: Request) {
	const session = await auth();

	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	const { metric, quantity, timestamp } = await req.json();

	try {
		await trackUsage({
			organizationId: session.organizationId,
			metric,
			quantity,
			timestamp,
		});

		return new Response(null, { status: 204 });
	} catch (error) {
		return new Response(error.message, { status: 400 });
	}
}
