import { config } from "@repo/config";
import type { SendEmailHandler } from "../../types";

const { from } = config.mails;

// biome-ignore lint/correctness/noUnusedFunctionParameters: This is to understand the available parameters
export const send: SendEmailHandler = async ({ to, subject, text, html }) => {
	// handle your custom email sending logic here
};
