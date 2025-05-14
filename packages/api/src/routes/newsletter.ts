import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { localeMiddleware } from "../middleware/locale";

export const newsletterRouter = new Hono().basePath("/newsletter").post(
	"/signup",
	localeMiddleware,
	validator(
		"form",
		z.object({
			email: z.string().email(),
		}),
	),
	describeRoute({
		tags: ["Newsletter"],
		summary: "Sign up for the newsletter",
		description: "Takes an email and sends a confirmation email",
		responses: {
			204: {
				description: "Email sent",
			},
			500: {
				description: "Could not send email",
				content: {
					"application/json": {
						schema: resolver(z.object({ error: z.string() })),
					},
				},
			},
		},
	}),
	async (c) => {
		const { email } = c.req.valid("form");
		const locale = c.get("locale");

		try {
			await sendEmail({
				to: email,
				locale,
				templateId: "newsletterSignup",
				context: {},
			});

			return c.body(null, 204);
		} catch (error) {
			logger.error(error);
			return c.json({ error: "Could not send email" }, 500);
		}
	},
);
