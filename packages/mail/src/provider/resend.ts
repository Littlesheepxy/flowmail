import { config } from "@repo/config";
import { Resend } from "resend";
import type { SendEmailHandler } from "../../types";

const resend = new Resend(process.env.RESEND_API_KEY);

const { from } = config.mails;

export const send: SendEmailHandler = async ({ to, subject, html, text }) => {
	await resend.emails.send({
		from,
		to: [to],
		subject,
		html,
		text,
	});
};
