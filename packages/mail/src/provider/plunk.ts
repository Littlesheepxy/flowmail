import { logger } from "@repo/logs";
import type { SendEmailHandler } from "../../types";

export const send: SendEmailHandler = async ({ to, subject, html, text }) => {
	const response = await fetch("https://api.useplunk.com/v1/send", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${process.env.PLUNK_API_KEY}`,
		},
		body: JSON.stringify({
			to,
			subject,
			body: html,
			text,
		}),
	});

	if (!response.ok) {
		logger.error(await response.json());

		throw new Error("Could not send email");
	}
};
