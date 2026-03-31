import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { z } from "zod/v4";
import { protectedProcedure } from "../../../orpc/procedures";

const sendEmailSchema = z.object({
	connectionId: z.string(),
	to: z.array(z.string()),
	cc: z.array(z.string()).optional(),
	subject: z.string(),
	htmlBody: z.string(),
	textBody: z.string().optional(),
	inReplyTo: z.string().optional(),
});

export const sendEmail = protectedProcedure
	.route({
		method: "POST",
		path: "/email-connections/{connectionId}/send",
		tags: ["EmailConnections"],
		summary: "Send an email via the connected account",
	})
	.input(sendEmailSchema)
	.handler(async ({ input }) => {
		const connection = await db.emailConnection.findUnique({
			where: { id: input.connectionId },
		});

		if (!connection) {
			throw new ORPCError("NOT_FOUND");
		}
		if (!connection.accessToken) {
			throw new ORPCError("BAD_REQUEST", { message: "No access token available" });
		}

		if (connection.provider === "feishu") {
			return await sendViaFeishu(connection, input);
		}

		if (connection.provider === "gmail") {
			return await sendViaGmail(connection, input);
		}

		throw new ORPCError("BAD_REQUEST", {
			message: `Send not supported for provider: ${connection.provider}`,
		});
	});

interface ConnectionRecord {
	email: string;
	accessToken: string | null;
}

interface SendInput {
	to: string[];
	cc?: string[];
	subject: string;
	htmlBody: string;
	textBody?: string;
	inReplyTo?: string;
}

async function sendViaFeishu(connection: ConnectionRecord, input: SendInput) {
	const token = connection.accessToken;
	const mailboxId = encodeURIComponent(connection.email || "me");

	const toAddrs = input.to.map((addr) => ({ mail_address: addr }));
	const ccAddrs = input.cc?.map((addr) => ({ mail_address: addr }));

	const body: Record<string, unknown> = {
		subject: input.subject,
		to: toAddrs,
		body_html: Buffer.from(input.htmlBody).toString("base64"),
	};

	if (ccAddrs && ccAddrs.length > 0) {
		body.cc = ccAddrs;
	}

	if (input.textBody) {
		body.body_plain_text = Buffer.from(input.textBody).toString("base64");
	}

	const res = await fetch(
		`https://open.feishu.cn/open-apis/mail/v1/user_mailboxes/${mailboxId}/messages`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		},
	);

	const json = (await res.json()) as { code?: number; msg?: string };

	if (json.code !== 0) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: `Feishu send failed: ${json.msg}`,
		});
	}

	return { success: true, provider: "feishu" };
}

async function sendViaGmail(connection: ConnectionRecord, input: SendInput) {
	const boundary = `boundary_${Date.now()}`;
	const toLine = input.to.join(", ");
	const ccLine = input.cc?.join(", ") ?? "";

	const rawEmail = [
		`From: ${connection.email}`,
		`To: ${toLine}`,
		ccLine ? `Cc: ${ccLine}` : "",
		`Subject: =?UTF-8?B?${Buffer.from(input.subject).toString("base64")}?=`,
		"MIME-Version: 1.0",
		`Content-Type: multipart/alternative; boundary="${boundary}"`,
		input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : "",
		input.inReplyTo ? `References: ${input.inReplyTo}` : "",
		"",
		`--${boundary}`,
		"Content-Type: text/plain; charset=UTF-8",
		"",
		input.textBody ?? "",
		`--${boundary}`,
		"Content-Type: text/html; charset=UTF-8",
		"",
		input.htmlBody,
		`--${boundary}--`,
	]
		.filter(Boolean)
		.join("\r\n");

	const encodedMessage = Buffer.from(rawEmail)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

	const res = await fetch(
		"https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${connection.accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ raw: encodedMessage }),
		},
	);

	if (!res.ok) {
		const err = await res.text();
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: `Gmail send failed: ${err}`,
		});
	}

	return { success: true, provider: "gmail" };
}
