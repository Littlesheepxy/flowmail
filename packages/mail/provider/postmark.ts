import { logger } from "@repo/logs";
import { config } from "../config";
import type { SendEmailHandler } from "../types";

export const send: SendEmailHandler = async ({
	to,
	from,
	subject,
	cc,
	bcc,
	replyTo,
	html,
}) => {
	const response = await fetch("https://api.postmarkapp.com/email", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Postmark-Server-Token": process.env
				.POSTMARK_SERVER_TOKEN as string,
		},
		body: JSON.stringify({
			From: from ?? config.mailFrom,
			To: to,
			CC: cc,
			BCC: bcc,
			ReplyTo: replyTo,
			Subject: subject,
			HtmlBody: html,
			MessageStream: "outbound",
		}),
	});

	if (!response.ok) {
		logger.error(await response.json());

		throw new Error("Could not send email");
	}
};
