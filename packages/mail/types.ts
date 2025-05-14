import type { Locale } from "@repo/i18n";

export interface SendEmailParams {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

export type SendEmailHandler = (params: SendEmailParams) => Promise<void>;

export interface MailProvider {
	send: SendEmailHandler;
}

export type BaseMailProps = {
	locale: Locale;
	translations: any;
};
