import { db } from "@repo/database";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { generateText, textModel as mcpTextModel, Output } from "@repo/ai";
import { verifyApiToken } from "@repo/api";
import { getSignedUrl } from "@repo/storage";
import { z } from "zod";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

function getOrgId(extra: { authInfo?: AuthInfo }): string {
	const orgId = extra.authInfo?.extra?.organizationId as string | undefined;
	if (!orgId) {
		throw new Error("Missing organizationId in auth context");
	}
	return orgId;
}

function assertOrgOwns(entity: { organizationId: string } | null, extra: { authInfo?: AuthInfo }) {
	if (!entity || entity.organizationId !== getOrgId(extra)) {
		throw new Error("Entity not found");
	}
}

const TEXT = "text" as const;

const rawHandler = createMcpHandler(
	(server) => {
		// ── Entity tools ──
		server.registerTool(
			"list_entities",
			{
				title: "List Entities",
				description:
					"List structured business entities (approvals, reports, issues, feedback) for an organization.",
				inputSchema: {
					type: z
						.enum(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK"])
						.optional()
						.describe("Filter by entity type"),
					status: z.string().optional().describe("Filter by status"),
					limit: z.number().optional().default(20).describe("Max results"),
				},
			},
			async ({ type, status, limit }, extra) => {
				const organizationId = getOrgId(extra);
				const where: Record<string, unknown> = { organizationId };
				if (type) { where.type = type; }
				if (status) { where.status = status; }

				const entities = await db.flowEntity.findMany({
					where,
					include: { assignee: { select: { name: true, email: true } } },
					orderBy: { updatedAt: "desc" },
					take: limit,
				});

				return {
					content: [{ type: TEXT, text: JSON.stringify(entities, null, 2) }],
				};
			},
		);

		server.registerTool(
			"get_entity",
			{
				title: "Get Entity",
				description:
					"Get full details of a business entity including its timeline of events and related email threads.",
				inputSchema: {
					entityId: z.string().describe("Entity ID"),
				},
			},
			async ({ entityId }, extra) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
					include: {
						assignee: { select: { name: true, email: true } },
						threads: {
							select: { subject: true, sender: true, snippet: true, receivedAt: true },
						},
						timeline: {
							orderBy: { createdAt: "asc" },
							include: { actor: { select: { name: true } } },
						},
					},
				});

				if (!entity) {
					return { content: [{ type: TEXT, text: "Entity not found" }], isError: true };
				}

				assertOrgOwns(entity, extra);

				return { content: [{ type: TEXT, text: JSON.stringify(entity, null, 2) }] };
			},
		);

		server.registerTool(
			"update_entity_status",
			{
				title: "Update Entity Status",
				description:
					"Update the status of a business entity (e.g., mark as completed, in_progress, blocked).",
				inputSchema: {
					entityId: z.string().describe("Entity ID"),
					status: z.string().describe("New status"),
					reason: z.string().optional().describe("Reason for change"),
				},
			},
			async ({ entityId, status, reason }, extra) => {
				const entity = await db.flowEntity.findUnique({ where: { id: entityId } });
				if (!entity) {
					return { content: [{ type: TEXT, text: "Entity not found" }], isError: true };
				}

				assertOrgOwns(entity, extra);

				const updated = await db.flowEntity.update({
					where: { id: entityId },
					data: { status },
				});

				await db.timelineEvent.create({
					data: {
						entityId,
						type: "status_changed",
						content: `Status changed from ${entity.status} to ${status}${reason ? `: ${reason}` : ""}`,
						metadata: JSON.stringify({
							previousStatus: entity.status, newStatus: status, reason, via: "mcp",
						}),
					},
				});

				return { content: [{ type: TEXT, text: JSON.stringify({ success: true, entity: updated }) }] };
			},
		);

		// ── Approval tools ──
		server.registerTool(
			"list_pending_approvals",
			{
				title: "List Pending Approvals",
				description:
					"List all pending approval requests for the organization.",
				inputSchema: {},
			},
			async (_args, extra) => {
				const organizationId = getOrgId(extra);
				const approvals = await db.flowEntity.findMany({
					where: { organizationId, type: "APPROVAL", status: "pending" },
					include: { assignee: { select: { name: true, email: true } } },
					orderBy: { createdAt: "desc" },
				});

				return {
					content: [{ type: TEXT, text: JSON.stringify({ count: approvals.length, approvals }) }],
				};
			},
		);

		server.registerTool(
			"approve_request",
			{
				title: "Approve Request",
				description:
					'Approve a pending approval request. Use list_pending_approvals first to get the entityId.',
				inputSchema: {
					entityId: z.string().describe("Approval entity ID"),
					comment: z.string().optional().describe("Optional approval comment"),
				},
			},
			async ({ entityId, comment }, extra) => {
				const entity = await db.flowEntity.findUnique({ where: { id: entityId } });
				if (!entity) {
					return { content: [{ type: TEXT, text: "Entity not found" }], isError: true };
				}

				assertOrgOwns(entity, extra);

				if (entity.type !== "APPROVAL" || entity.status !== "pending") {
					return { content: [{ type: TEXT, text: "Entity is not a pending approval" }], isError: true };
				}

				const updated = await db.flowEntity.update({
					where: { id: entityId },
					data: { status: "approved" },
				});

				await db.timelineEvent.create({
					data: {
						entityId,
						type: "action_taken",
						content: `Approved${comment ? `: ${comment}` : ""}`,
						metadata: JSON.stringify({ action: "approved", comment, via: "mcp" }),
					},
				});

				return {
					content: [{ type: TEXT, text: JSON.stringify({ success: true, message: `Approval "${updated.title}" has been approved`, entity: updated }) }],
				};
			},
		);

		server.registerTool(
			"reject_request",
			{
				title: "Reject Request",
				description: 'Reject a pending approval request with a required reason.',
				inputSchema: {
					entityId: z.string().describe("Approval entity ID"),
					reason: z.string().describe("Required reason for rejection"),
				},
			},
			async ({ entityId, reason }, extra) => {
				const entity = await db.flowEntity.findUnique({ where: { id: entityId } });
				if (!entity) {
					return { content: [{ type: TEXT, text: "Entity not found" }], isError: true };
				}

				assertOrgOwns(entity, extra);

				if (entity.type !== "APPROVAL" || entity.status !== "pending") {
					return { content: [{ type: TEXT, text: "Entity is not a pending approval" }], isError: true };
				}

				const updated = await db.flowEntity.update({
					where: { id: entityId },
					data: { status: "rejected" },
				});

				await db.timelineEvent.create({
					data: {
						entityId,
						type: "action_taken",
						content: `Rejected: ${reason}`,
						metadata: JSON.stringify({ action: "rejected", reason, via: "mcp" }),
					},
				});

				return {
					content: [{ type: TEXT, text: JSON.stringify({ success: true, message: `Approval "${updated.title}" has been rejected`, entity: updated }) }],
				};
			},
		);

		// ── Report tools ──
		server.registerTool(
			"list_reports",
			{
				title: "List Reports",
				description: "List report entities for the organization.",
				inputSchema: {
					status: z.string().optional().describe("Filter by status"),
				},
			},
			async ({ status }, extra) => {
				const organizationId = getOrgId(extra);
				const where: Record<string, unknown> = { organizationId, type: "REPORT" };
				if (status) { where.status = status; }

				const reports = await db.flowEntity.findMany({
					where,
					include: { assignee: { select: { name: true, email: true } } },
					orderBy: { updatedAt: "desc" },
				});

				return { content: [{ type: TEXT, text: JSON.stringify(reports, null, 2) }] };
			},
		);

		server.registerTool(
			"get_report_summary",
			{
				title: "Get Report Summary",
				description: "Get AI-generated summary of a report entity.",
				inputSchema: {
					entityId: z.string().describe("Report entity ID"),
				},
			},
			async ({ entityId }, extra) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
					select: { id: true, organizationId: true, title: true, aiSummary: true, extractedFields: true, status: true },
				});

				if (!entity) {
					return { content: [{ type: TEXT, text: "Report not found" }], isError: true };
				}

				assertOrgOwns(entity, extra);

				return {
					content: [{
						type: TEXT,
						text: JSON.stringify({
							title: entity.title,
							status: entity.status,
							summary: entity.aiSummary,
							fields: entity.extractedFields ? JSON.parse(entity.extractedFields) : {},
						}, null, 2),
					}],
				};
			},
		);

		// ── Email connection tools ──
		server.registerTool(
			"list_email_connections",
			{
				title: "List Email Connections",
				description: "List all connected email accounts for the organization.",
				inputSchema: {},
			},
			async (_args, extra) => {
				const organizationId = getOrgId(extra);
				const connections = await db.emailConnection.findMany({
					where: { organizationId },
					select: { id: true, provider: true, email: true, isActive: true, lastSyncAt: true },
				});

				return { content: [{ type: TEXT, text: JSON.stringify(connections, null, 2) }] };
			},
		);

		server.registerTool(
			"search_emails",
			{
				title: "Search Emails",
				description: "Search emails by keyword, sender, or subject. Returns matching email threads with their associated entities.",
				inputSchema: {
					query: z.string().optional().describe("Keyword to search in subject and body"),
					sender: z.string().optional().describe("Filter by sender email or name"),
					limit: z.number().optional().default(10).describe("Max results"),
				},
			},
			async ({ query, sender, limit }, extra) => {
				const organizationId = getOrgId(extra);
				const where: Record<string, unknown> = { organizationId };
				if (query) {
					where.OR = [
						{ subject: { contains: query, mode: "insensitive" } },
						{ bodyText: { contains: query, mode: "insensitive" } },
						{ snippet: { contains: query, mode: "insensitive" } },
					];
				}
				if (sender) {
					where.AND = [
						...(Array.isArray(where.AND) ? (where.AND as unknown[]) : []),
						{
							OR: [
								{ sender: { contains: sender, mode: "insensitive" } },
								{ senderName: { contains: sender, mode: "insensitive" } },
							],
						},
					];
				}

				const threads = await db.emailThread.findMany({
					where,
					select: {
						id: true, subject: true, sender: true, senderName: true,
						snippet: true, receivedAt: true, entityId: true,
						entity: { select: { id: true, title: true, type: true, status: true } },
					},
					orderBy: { receivedAt: "desc" },
					take: limit,
				});

				return {
					content: [{
						type: TEXT,
						text: JSON.stringify({
							count: threads.length,
							emails: threads.map((t) => ({
								id: t.id, subject: t.subject, sender: t.senderName ?? t.sender,
								senderEmail: t.sender, snippet: t.snippet,
								receivedAt: t.receivedAt.toISOString(), entity: t.entity,
							})),
						}, null, 2),
					}],
				};
			},
		);

		// ── Timeline tools ──
		server.registerTool(
			"add_timeline_event",
			{
				title: "Add Timeline Event",
				description:
					"Add a manual event to an entity's timeline. Use when recording milestones, notes, decisions, or any significant moment.",
				inputSchema: {
					entityId: z.string().describe("Entity ID to add event to"),
					type: z
						.enum(["note", "milestone", "action_taken", "status_changed", "ai_summary", "email_sent"])
						.describe("Type of timeline event"),
					content: z.string().min(1).describe("Event content / description"),
					metadata: z
						.record(z.string(), z.unknown())
						.optional()
						.describe("Optional structured metadata"),
				},
			},
			async ({ entityId, type, content, metadata }, extra) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
					select: { id: true, organizationId: true, title: true },
				});
				if (!entity) {
					return { content: [{ type: TEXT, text: "Entity not found" }], isError: true };
				}

				assertOrgOwns(entity, extra);

				const enrichedMetadata = { ...(metadata ?? {}), via: "mcp" };
				const event = await db.timelineEvent.create({
					data: { entityId, type, content, metadata: JSON.stringify(enrichedMetadata) },
				});

				return {
					content: [{ type: TEXT, text: JSON.stringify({ success: true, message: `Timeline event added to "${entity.title}"`, event }) }],
				};
			},
		);

		server.registerTool(
			"get_timeline_diff",
			{
				title: "Get Timeline Semantic Diff",
				description:
					"Get an AI-powered semantic diff between two points in an entity's timeline.",
				inputSchema: {
					entityId: z.string().describe("Entity ID"),
					fromEventId: z.string().optional().describe("Starting timeline event ID (defaults to first event)"),
					toEventId: z.string().optional().describe("Ending timeline event ID (defaults to latest event)"),
				},
			},
			async ({ entityId, fromEventId, toEventId }, extra) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
					select: { id: true, organizationId: true, type: true, title: true },
				});
				if (!entity) {
					return { content: [{ type: TEXT, text: "Entity not found" }], isError: true };
				}

				assertOrgOwns(entity, extra);

				const allEvents = await db.timelineEvent.findMany({
					where: { entityId },
					orderBy: { createdAt: "asc" },
				});

				if (allEvents.length < 2) {
					return {
						content: [{ type: TEXT, text: JSON.stringify({ summary: "Not enough timeline events for a diff", events: allEvents }) }],
					};
				}

				const fromIdx = fromEventId ? allEvents.findIndex((e) => e.id === fromEventId) : 0;
				const toIdx = toEventId ? allEvents.findIndex((e) => e.id === toEventId) : allEvents.length - 1;
				const rangeEvents = allEvents.slice(Math.max(0, fromIdx), Math.min(allEvents.length, toIdx + 1));
				const eventsText = rangeEvents.map((e) => `[${e.createdAt.toISOString()}] ${e.type}: ${e.content}`).join("\n");

				if (!process.env.OPENAI_API_KEY) {
					return {
						content: [{ type: TEXT, text: JSON.stringify({ summary: `${rangeEvents.length} events in selected range`, events: rangeEvents }) }],
					};
				}

				const diffSchema = z.object({
					summary: z.string(),
					changes: z.array(z.object({
						field: z.string(), before: z.string().nullable(),
						after: z.string().nullable(), significance: z.enum(["low", "medium", "high", "critical"]),
					})),
					riskSignals: z.array(z.string()),
					progressDelta: z.number().nullable(),
					recommendation: z.string().nullable(),
				});

				const { output: diff } = await generateText({
					model: mcpTextModel,
					output: Output.object({ schema: diffSchema }),
					prompt: `Analyze these timeline events for entity "${entity.title}" (type: ${entity.type}).\n\nEvents:\n${eventsText}\n\nProduce a semantic diff: what changed, risk signals, progress delta (-100 to 100), and recommendation.`,
				});

				return {
					content: [{ type: TEXT, text: JSON.stringify({ ...diff, fromEvent: allEvents[fromIdx], toEvent: allEvents[toIdx] }, null, 2) }],
				};
			},
		);

		server.registerTool(
			"predict_entity_risk",
			{
				title: "Predict Entity Risk",
				description:
					"AI-powered risk prediction for a business entity. Analyzes timeline history, extracted fields, and current status.",
				inputSchema: {
					entityId: z.string().describe("Entity ID to analyze"),
				},
			},
			async ({ entityId }, extra) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
					include: { timeline: { orderBy: { createdAt: "asc" } } },
				});

				if (!entity) {
					return { content: [{ type: TEXT, text: "Entity not found" }], isError: true };
				}

				assertOrgOwns(entity, extra);

				if (!process.env.OPENAI_API_KEY) {
					return {
						content: [{ type: TEXT, text: JSON.stringify({ riskLevel: "unknown", message: "AI prediction requires OPENAI_API_KEY" }) }],
					};
				}

				const fields = entity.extractedFields ? JSON.parse(entity.extractedFields) : {};
				const timelineText = entity.timeline.map((e) => `[${e.createdAt.toISOString()}] ${e.type}: ${e.content}`).join("\n");

				const riskSchema = z.object({
					riskLevel: z.enum(["low", "medium", "high", "critical"]),
					riskFactors: z.array(z.string()),
					predictedOutcome: z.string(),
					suggestedActions: z.array(z.string()),
					deadlineRisk: z.object({
						hasDeadline: z.boolean(), deadline: z.string().nullable(),
						daysRemaining: z.number().nullable(), isAtRisk: z.boolean(),
					}),
					confidence: z.number().min(0).max(1),
				});

				const { output: prediction } = await generateText({
					model: mcpTextModel,
					output: Output.object({ schema: riskSchema }),
					prompt: `Analyze risk for entity "${entity.title}" (${entity.type}, status: ${entity.status}).\n\nFields: ${JSON.stringify(fields, null, 2)}\nTimeline: ${timelineText || "(none)"}\nToday: ${new Date().toISOString().split("T")[0]}\n\nAssess risk level, factors, predicted outcome, suggested actions, and deadline risk.`,
				});

				return { content: [{ type: TEXT, text: JSON.stringify(prediction, null, 2) }] };
			},
		);

		// ── Attachment tools ──
		server.registerTool(
			"list_attachments",
			{
				title: "List Attachments",
				description:
					"List all email attachments for a given entity or email thread. Returns filename, type, size, and download URL.",
				inputSchema: {
					entityId: z.string().optional().describe("Filter by entity ID"),
					threadId: z.string().optional().describe("Filter by email thread ID"),
				},
			},
			async ({ entityId, threadId }, extra) => {
				const organizationId = getOrgId(extra);

				// Resolve thread IDs from entity if needed
				let threadIds: string[] = threadId ? [threadId] : [];
				if (entityId && !threadId) {
					const threads = await db.emailThread.findMany({
						where: { entityId, organizationId },
						select: { id: true },
					});
					threadIds = threads.map((t) => t.id);
				}

				if (threadIds.length === 0) {
					return { content: [{ type: TEXT, text: JSON.stringify({ count: 0, attachments: [] }) }] };
				}

				const attachments = await db.emailAttachment.findMany({
					where: { threadId: { in: threadIds } },
					include: { thread: { select: { subject: true, entityId: true } } },
					orderBy: { createdAt: "desc" },
				});

				// Generate signed download URLs for stored attachments
				const storageEnabled = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID);
				const result = await Promise.all(
					attachments.map(async (att) => {
						let downloadUrl: string | null = null;
						if (att.storageKey && storageEnabled) {
							try {
								downloadUrl = await getSignedUrl(att.storageKey, {
									bucket: "attachments",
									expiresIn: 3600,
								});
							} catch {
								// ignore signing errors
							}
						}
						return {
							id: att.id,
							filename: att.filename,
							mimeType: att.mimeType,
							size: att.size,
							threadId: att.threadId,
							threadSubject: att.thread.subject,
							entityId: att.thread.entityId,
							hasContent: !!att.storageKey,
							downloadUrl,
						};
					}),
				);

				return {
					content: [{ type: TEXT, text: JSON.stringify({ count: result.length, attachments: result }, null, 2) }],
				};
			},
		);

		server.registerTool(
			"read_attachment",
			{
				title: "Read Attachment Content",
				description:
					"Read and extract text content from an email attachment (PDF, Word, or plain text). For images, returns a description prompt. Returns extracted text that AI can reason over.",
				inputSchema: {
					attachmentId: z.string().describe("Attachment ID from list_attachments"),
				},
			},
			async ({ attachmentId }, extra) => {
				const organizationId = getOrgId(extra);

				const attachment = await db.emailAttachment.findUnique({
					where: { id: attachmentId },
					include: {
						thread: {
							select: {
								organizationId: true,
								subject: true,
								entityId: true,
							},
						},
					},
				});

				if (!attachment || attachment.thread.organizationId !== organizationId) {
					return { content: [{ type: TEXT, text: "Attachment not found" }], isError: true };
				}

				if (!attachment.storageKey) {
					return {
						content: [{
							type: TEXT,
							text: JSON.stringify({
								filename: attachment.filename,
								mimeType: attachment.mimeType,
								status: "not_stored",
								message: "This attachment was received before storage was enabled. Only attachments received after the storage upgrade are available for reading.",
							}),
						}],
					};
				}

				// Generate a signed URL for the attachment
				const storageEnabled = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID);
				if (!storageEnabled) {
					return {
						content: [{ type: TEXT, text: JSON.stringify({ status: "storage_not_configured", message: "S3 storage is not configured on this server." }) }],
					};
				}

				let downloadUrl: string;
				try {
					downloadUrl = await getSignedUrl(attachment.storageKey, {
						bucket: "attachments",
						expiresIn: 300,
					});
				} catch {
					return {
						content: [{ type: TEXT, text: JSON.stringify({ status: "error", message: "Failed to generate download URL" }) }],
						isError: true,
					};
				}

			const mime = attachment.mimeType ?? "";
			const filename = attachment.filename ?? "";
			const isImage = mime.startsWith("image/");
			const isPdf = mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
			const isText = mime.startsWith("text/") || mime === "application/json";
			// .docx = officedocument.wordprocessingml, .doc = msword, mammoth supports both
			const isWord =
				mime.includes("wordprocessingml") ||
				mime.includes("msword") ||
				mime.includes("word") ||
				filename.toLowerCase().endsWith(".docx") ||
				filename.toLowerCase().endsWith(".doc");

				if (isImage) {
					// For images, return a download URL and instruct the agent to use vision
					return {
						content: [{
							type: TEXT,
							text: JSON.stringify({
								filename: attachment.filename,
								mimeType: attachment.mimeType,
								size: attachment.size,
								type: "image",
								downloadUrl,
								message: "This is an image attachment. Use the downloadUrl to fetch and analyze the image with a vision model.",
							}, null, 2),
						}],
					};
				}

				if (isPdf || isWord || isText) {
					// Fetch the file and extract text server-side
					try {
						const fileRes = await fetch(downloadUrl);
						if (!fileRes.ok) {
							throw new Error(`HTTP ${fileRes.status}`);
						}
						const buf = Buffer.from(await fileRes.arrayBuffer());

						let extractedText: string;

				if (isText) {
					extractedText = buf.toString("utf-8");
				} else if (isPdf) {
					try {
						const parsed = await pdfParse(buf);
						extractedText = parsed.text || "[PDF parsed but no text content found]";
					} catch (parseErr) {
						extractedText = `[PDF parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}]\n\nDownload URL: ${downloadUrl}`;
					}
				} else if (isWord) {
					try {
						const result = await mammoth.extractRawText({ buffer: buf });
						extractedText = result.value || "[Word document parsed but no text content found]";
						if (result.messages.length > 0) {
							const warnings = result.messages.filter(m => m.type === "warning").map(m => m.message).join("; ");
							if (warnings) {
								extractedText += `\n\n[Parse warnings: ${warnings}]`;
							}
						}
					} catch (parseErr) {
						extractedText = `[Word parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}]\n\nDownload URL: ${downloadUrl}`;
					}
				} else {
					// Other binary formats: return metadata + download URL
					extractedText = `[Unsupported format: ${attachment.filename}, ${buf.length} bytes, type: ${mime}]\n\nDownload URL for manual processing: ${downloadUrl}`;
				}

						return {
							content: [{
								type: TEXT,
								text: JSON.stringify({
									filename: attachment.filename,
									mimeType: attachment.mimeType,
									size: buf.length,
									threadSubject: attachment.thread.subject,
									entityId: attachment.thread.entityId,
									content: extractedText.slice(0, 50000), // cap at 50k chars
									truncated: extractedText.length > 50000,
								}, null, 2),
							}],
						};
					} catch (fetchErr) {
						return {
							content: [{
								type: TEXT,
								text: JSON.stringify({
									status: "fetch_error",
									message: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
									downloadUrl,
								}),
							}],
							isError: true,
						};
					}
				}

				// Unknown type: just return metadata + download URL
				return {
					content: [{
						type: TEXT,
						text: JSON.stringify({
							filename: attachment.filename,
							mimeType: attachment.mimeType,
							size: attachment.size,
							type: "unknown",
							downloadUrl,
							message: "Unsupported file type for direct extraction. Use downloadUrl to fetch manually.",
						}, null, 2),
					}],
				};
			},
		);

		server.registerTool(
			"get_entity_timeline",
			{
				title: "Get Entity Timeline",
				description:
					"Get the full timeline of events for a business entity, ordered chronologically.",
				inputSchema: {
					entityId: z.string().describe("Entity ID"),
					types: z
						.array(z.enum([
							"email_received", "email_sent", "status_changed",
							"action_taken", "ai_summary", "milestone", "note",
						]))
						.optional()
						.describe("Filter by event types"),
				},
			},
			async ({ entityId, types }, extra) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
					select: { id: true, organizationId: true, title: true, type: true, status: true },
				});

				if (!entity) {
					return { content: [{ type: TEXT, text: "Entity not found" }], isError: true };
				}

				assertOrgOwns(entity, extra);

				const where: Record<string, unknown> = { entityId };
				if (types && types.length > 0) {
					where.type = { in: types };
				}

				const timeline = await db.timelineEvent.findMany({
					where,
					orderBy: { createdAt: "asc" },
					include: { actor: { select: { name: true, email: true } } },
				});

				return {
					content: [{
						type: TEXT,
						text: JSON.stringify({
							entity: { id: entity.id, title: entity.title, type: entity.type, status: entity.status },
							totalEvents: timeline.length,
							timeline,
						}, null, 2),
					}],
				};
			},
		);
	},
	{},
	{
		basePath: "/mcp",
		maxDuration: 60,
	},
);

async function mcpVerifyToken(
	_req: Request,
	bearerToken?: string,
): Promise<AuthInfo | undefined> {
	if (!bearerToken) {
		return undefined;
	}

	const result = await verifyApiToken(bearerToken);
	if (!result) {
		return undefined;
	}

	return {
		token: bearerToken,
		clientId: result.tokenId,
		scopes: result.scopes,
		extra: {
			organizationId: result.organizationId,
		},
	};
}

const handler = withMcpAuth(rawHandler, mcpVerifyToken, {
	required: true,
});

export { handler as GET, handler as POST, handler as DELETE };
