import { ORPCError } from "@orpc/client";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { z } from "zod";
import { localeMiddleware } from "../../../orpc/middleware/locale-middleware";
import { publicProcedure } from "../../../orpc/procedures";

export const subscribeToNewsletter = publicProcedure
	.route({
		method: "POST",
		path: "/newsletter",
		tags: ["Newsletter"],
		summary: "Subscribe to newsletter",
	})
	.input(
		z.object({
			email: z.string().email(),
		}),
	)
	.use(localeMiddleware)
	.handler(async ({ input, context: { locale } }) => {
		const { email } = input;

		try {
			// ... add your crm or email service integration here to store the email of the user

			await sendEmail({
				to: email,
				locale,
				templateId: "newsletterSignup",
				context: {},
			});
		} catch (error) {
			logger.error(error);
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
