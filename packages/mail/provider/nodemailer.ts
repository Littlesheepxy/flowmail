import nodemailer from "nodemailer";
import { config } from "../config";
import type { SendEmailHandler } from "../types";

export const send: SendEmailHandler = async ({
	to,
	from,
	subject,
	cc,
	bcc,
	replyTo,
	text,
	html,
}) => {
	const transporter = nodemailer.createTransport({
		host: process.env.MAIL_HOST as string,
		port: Number.parseInt(process.env.MAIL_PORT as string, 10),
		auth: {
			user: process.env.MAIL_USER as string,
			pass: process.env.MAIL_PASS as string,
		},
	});

	await transporter.sendMail({
		to,
		from: from ?? config.mailFrom,
		cc,
		bcc,
		replyTo,
		subject,
		text,
		html,
	});
};
