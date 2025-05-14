import { config } from "@repo/config";
import { logger } from "@repo/logs";
import type { SendEmailHandler } from "../../types";

const { from } = config.mails;

const mailgunDomain = process.env.MAILGUN_DOMAIN as string;
const mailgunApiKey = process.env.MAILGUN_API_KEY as string;

export const send: SendEmailHandler = async ({ to, subject, html, text }) => {
	if (!mailgunDomain || !mailgunApiKey) {
		throw new Error("MAILGUN_DOMAIN and MAILGUN_API_KEY must be set");
	}

	const body = new FormData();
	body.append("from", from);
	body.append("to", to);
	body.append("subject", subject);
	body.append("text", text);
	if (html) {
		body.append("html", html);
	}

	const response = await fetch(
		`https://api.mailgun.net/v3/${mailgunDomain}/messages`,
		{
			method: "POST",
			headers: {
				Authorization: `Basic ${Buffer.from(
					`api:${mailgunApiKey}`,
				).toString("base64")}`,
			},
			body,
		},
	);

	if (!response.ok) {
		logger.error(await response.text());

		throw new Error("Could not send email");
	}
};
