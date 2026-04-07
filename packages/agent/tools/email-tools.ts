import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";

export function createEmailTools(deps: {
	getConnector: (provider: string) => {
		fetchNewEmails: (
			config: Record<string, unknown>,
			cursor: string | null,
		) => Promise<{ emails: Array<Record<string, unknown>>; newCursor: string | null }>;
	};
	processEmail: (params: Record<string, unknown>) => Promise<{
		success: boolean;
		entityId?: string;
		classification?: string;
	}>;
	triggerNotification: (params: {
		organizationId: string;
		type: string;
		entityId: string;
		title: string;
		body: string;
	}) => Promise<unknown>;
}) {
	return {
		list_connections: tool({
			description:
				"列出当前组织已连接的邮箱账号。当用户问'连了哪些邮箱'、'邮箱状态'时调用。",
			inputSchema: z.object({
				organizationId: z.string(),
			}),
			execute: async (input: { organizationId: string }) => {
				const connections = await db.emailConnection.findMany({
					where: { organizationId: input.organizationId },
					select: {
						id: true,
						provider: true,
						email: true,
						isActive: true,
						lastSyncAt: true,
						authType: true,
					},
					orderBy: { createdAt: "desc" },
				});
				return {
					count: connections.length,
					connections: connections.map((c) => ({
						id: c.id,
						provider: c.provider,
						email: c.email,
						isActive: c.isActive,
						lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
						authType: c.authType,
					})),
				};
			},
		}),

		sync_emails: tool({
			description:
				"触发指定邮箱连接的邮件同步。拉取新邮件并进行 AI 处理。",
			inputSchema: z.object({
				connectionId: z
					.string()
					.describe("邮箱连接 ID，从 list_connections 结果获取"),
			}),
			execute: async (input: { connectionId: string }) => {
				const connection = await db.emailConnection.findUnique({
					where: { id: input.connectionId },
				});
				if (!connection) {
					return { error: "邮箱连接未找到" };
				}
				if (!connection.isActive) {
					return { error: "该邮箱连接已停用" };
				}

				const connector = deps.getConnector(connection.provider);
				const { emails, newCursor } = await connector.fetchNewEmails(
					{
						provider: connection.provider,
						email: connection.email,
						accessToken: connection.accessToken,
						refreshToken: connection.refreshToken,
						imapHost: connection.imapHost,
						imapPort: connection.imapPort,
						imapPassword: connection.imapPassword,
						authType: connection.authType,
						maxSyncCount: connection.maxSyncCount,
					},
					connection.syncCursor,
				);

				let processed = 0;
				let errors = 0;
				for (const email of emails) {
					const existing = await db.emailThread.findUnique({
						where: {
							connectionId_externalThreadId: {
								connectionId: connection.id,
								externalThreadId: email.externalId as string,
							},
						},
					});
					if (existing) {
						continue;
					}

					const result = await deps.processEmail({
						threadId:
							(email.threadId as string) ??
							(email.externalId as string),
						subject: email.subject,
						sender: email.sender,
						senderEmail: email.senderEmail,
						content: email.content,
						bodyHtml: email.bodyHtml,
						bodyText: email.bodyText,
						toRecipients: email.toRecipients,
						ccRecipients: email.ccRecipients,
						attachments: email.attachments,
						organizationId: connection.organizationId,
						connectionId: connection.id,
						externalThreadId: email.externalId,
						receivedAt: email.receivedAt,
						messageId: email.messageId,
					});
					if (result.success) {
						processed++;
						if (result.entityId) {
							deps.triggerNotification({
								organizationId: connection.organizationId,
								type: "NEW_ENTITY",
								entityId: result.entityId,
								title: `新事项：${email.subject as string}`,
								body: `来自 ${email.senderEmail as string} 的邮件已创建新事项（${result.classification ?? "未分类"}）`,
							}).catch(() => {});
						}
					} else {
						errors++;
					}
				}

				await db.emailConnection.update({
					where: { id: connection.id },
					data: {
						lastSyncAt: new Date(),
						...(newCursor ? { syncCursor: newCursor } : {}),
					},
				});

				return {
					email: connection.email,
					provider: connection.provider,
					fetched: emails.length,
					processed,
					errors,
				};
			},
		}),

		send_email: tool({
			description:
				"通过已连接的邮箱发送邮件。当用户说'发邮件'、'回复邮件'时调用。",
			inputSchema: z.object({
				connectionId: z.string().describe("发件邮箱连接 ID"),
				to: z.array(z.string()).describe("收件人邮箱地址列表"),
				cc: z.array(z.string()).optional().describe("抄送邮箱地址列表"),
				subject: z.string().describe("邮件主题"),
				htmlBody: z.string().describe("邮件正文（HTML 格式）"),
				textBody: z.string().optional().describe("纯文本正文（备选）"),
				inReplyTo: z
					.string()
					.optional()
					.describe("回复的原邮件 Message-ID"),
			}),
			execute: async (input: {
				connectionId: string;
				to: string[];
				cc?: string[];
				subject: string;
				htmlBody: string;
				textBody?: string;
				inReplyTo?: string;
			}) => {
				const connection = await db.emailConnection.findUnique({
					where: { id: input.connectionId },
				});
				if (!connection) {
					return { error: "邮箱连接未找到" };
				}
				if (!connection.accessToken) {
					return { error: "邮箱缺少访问令牌，请重新授权" };
				}

				if (connection.provider === "feishu") {
					const mailboxId = encodeURIComponent(
						connection.email || "me",
					);
					const toAddrs = input.to.map((addr) => ({
						mail_address: addr,
					}));
					const body: Record<string, unknown> = {
						subject: input.subject,
						to: toAddrs,
						body_html: Buffer.from(input.htmlBody).toString(
							"base64",
						),
					};
					if (input.cc && input.cc.length > 0) {
						body.cc = input.cc.map((addr) => ({
							mail_address: addr,
						}));
					}
					const res = await fetch(
						`https://open.feishu.cn/open-apis/mail/v1/user_mailboxes/${mailboxId}/messages`,
						{
							method: "POST",
							headers: {
								Authorization: `Bearer ${connection.accessToken}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify(body),
						},
					);
					const json = (await res.json()) as {
						code?: number;
						msg?: string;
					};
					if (json.code !== 0) {
						return { error: `飞书发信失败：${json.msg}` };
					}
					return {
						success: true,
						provider: "feishu",
						from: connection.email,
						to: input.to,
						subject: input.subject,
					};
				}

				if (connection.provider === "gmail") {
					const boundary = `boundary_${Date.now()}`;
					const rawEmail = [
						`From: ${connection.email}`,
						`To: ${input.to.join(", ")}`,
						input.cc?.length
							? `Cc: ${input.cc.join(", ")}`
							: "",
						`Subject: =?UTF-8?B?${Buffer.from(input.subject).toString("base64")}?=`,
						"MIME-Version: 1.0",
						`Content-Type: multipart/alternative; boundary="${boundary}"`,
						input.inReplyTo
							? `In-Reply-To: ${input.inReplyTo}`
							: "",
						input.inReplyTo
							? `References: ${input.inReplyTo}`
							: "",
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
						return { error: `Gmail 发信失败：${err}` };
					}
					return {
						success: true,
						provider: "gmail",
						from: connection.email,
						to: input.to,
						subject: input.subject,
					};
				}

				return { error: `暂不支持 ${connection.provider} 发信` };
			},
		}),

		search_emails: tool({
			description:
				"搜索组织内的邮件。可按关键词、发件人、主题筛选。",
			inputSchema: z.object({
				organizationId: z.string(),
				query: z
					.string()
					.optional()
					.describe("关键词搜索（匹配主题和正文）"),
				sender: z
					.string()
					.optional()
					.describe("发件人邮箱或名字"),
				limit: z.number().default(10).describe("最多返回条数"),
			}),
			execute: async (input: {
				organizationId: string;
				query?: string;
				sender?: string;
				limit: number;
			}) => {
				const where: Record<string, unknown> = {
					organizationId: input.organizationId,
				};

				if (input.query) {
					where.OR = [
						{
							subject: {
								contains: input.query,
								mode: "insensitive",
							},
						},
						{
							bodyText: {
								contains: input.query,
								mode: "insensitive",
							},
						},
						{
							snippet: {
								contains: input.query,
								mode: "insensitive",
							},
						},
					];
				}
				if (input.sender) {
					where.AND = [
						...(Array.isArray(where.AND)
							? (where.AND as unknown[])
							: []),
						{
							OR: [
								{
									sender: {
										contains: input.sender,
										mode: "insensitive",
									},
								},
								{
									senderName: {
										contains: input.sender,
										mode: "insensitive",
									},
								},
							],
						},
					];
				}

				const threads = await db.emailThread.findMany({
					where,
					select: {
						id: true,
						subject: true,
						sender: true,
						senderName: true,
						snippet: true,
						receivedAt: true,
						entityId: true,
						entity: {
							select: {
								id: true,
								title: true,
								type: true,
								status: true,
							},
						},
					},
					orderBy: { receivedAt: "desc" },
					take: input.limit,
				});

				return {
					count: threads.length,
					emails: threads.map((t) => ({
						id: t.id,
						subject: t.subject,
						sender: t.senderName ?? t.sender,
						senderEmail: t.sender,
						snippet: t.snippet,
						receivedAt: t.receivedAt.toISOString(),
						entity: t.entity
							? {
									id: t.entity.id,
									title: t.entity.title,
									type: t.entity.type,
									status: t.entity.status,
								}
							: null,
					})),
				};
			},
		}),
	};
}
