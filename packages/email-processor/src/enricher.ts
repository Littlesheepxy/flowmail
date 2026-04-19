import { db } from "@repo/database";
import { readEntityAttachments } from "./attachment-reader";
import { classifyEmail, classifyEmailDynamic } from "./classifier";
import { extractApprovalFields, extractReportFields } from "./extractor";
import { detectMultipleProjects } from "./multi-project-detector";
import { ensureDefaultCategories } from "./seed-categories";
import { summarizeThread } from "./summarizer";
import { generateTags } from "./tagger";

const SLUG_TO_ENTITY_TYPE: Record<string, string> = {
	approval: "APPROVAL",
	report: "REPORT",
	issue: "ISSUE",
	feedback: "FEEDBACK",
	noise: "NOISE",
};

export async function enrichEntityById(entityId: string): Promise<{
	entityId: string;
	type: string;
	categorySlug?: string;
	confidence: number;
	summary: string;
}> {
	const LOG_TAG = "[Enricher]";

	const entity = await db.flowEntity.findUnique({
		where: { id: entityId },
		include: {
			threads: {
				select: {
					subject: true,
					sender: true,
					senderName: true,
					bodyText: true,
					bodyHtml: true,
					snippet: true,
				},
				orderBy: { receivedAt: "desc" },
				take: 3,
			},
		},
	});

	if (!entity) {
		throw new Error(`Entity ${entityId} not found`);
	}

	if (entity.threads.length === 0) {
		throw new Error(`Entity ${entityId} has no threads`);
	}

	const primaryThread = entity.threads[0];
	let content = extractBestContent(primaryThread);
	const subject = primaryThread.subject ?? entity.title;
	const sender = primaryThread.senderName ?? primaryThread.sender ?? "";

	// When the email body is thin (e.g. forwarded emails where the real
	// data lives in attachments like .docx / .xlsx / .pdf), read and
	// append the attachment text so the AI has something to work with.
	let attachmentFilenames: string[] = [];
	try {
		const result = await readEntityAttachments(entityId);
		if (result.text) {
			content = content
				? `${content}\n\n${result.text}`
				: result.text;
			attachmentFilenames = result.filenames;
			console.info(`${LOG_TAG} Appended attachment content entity=${entityId} files=${result.filenames.join(", ")} chars=${result.text.length}`);
		}

		// Visible footprint: log a timeline event so users can see "AI 读取了哪些附件"
		if (result.details.length > 0) {
			const totalChars = result.details.reduce((sum, d) => sum + d.chars, 0);
			const okFiles = result.details.filter((d) => d.chars > 0);
			const ocrFiles = result.details.filter((d) => d.ocrUsed);
			const failedFiles = result.details.filter((d) => d.error);
			const summary = okFiles.length > 0
				? `已读取 ${okFiles.length} 个附件（共 ${totalChars} 字${ocrFiles.length > 0 ? `，其中 ${ocrFiles.length} 个走了 OCR` : ""}${failedFiles.length > 0 ? `，${failedFiles.length} 个解析失败` : ""}${result.skipped > 0 ? `，${result.skipped} 个因长度受限被跳过` : ""}）`
				: `检测到 ${result.details.length} 个附件，但全部解析失败`;
			await db.timelineEvent.create({
				data: {
					entityId,
					type: "attachment_parsed",
					content: summary,
					metadata: JSON.stringify({
						details: result.details,
						totalChars,
						ocrUsed: ocrFiles.length > 0,
						skipped: result.skipped,
						totalParseable: result.totalParseable,
					}),
				},
			}).catch((err) => {
				console.warn(`${LOG_TAG} Failed to log attachment_parsed event entity=${entityId}`, err instanceof Error ? err.message : String(err));
			});
		}
	} catch (err) {
		console.warn(`${LOG_TAG} Attachment read failed (non-critical) entity=${entityId}`, err instanceof Error ? err.message : String(err));
	}

	console.info(`${LOG_TAG} Starting entity=${entityId} subject="${subject.slice(0, 60)}" sender="${sender}" contentLen=${content.length} attachments=${attachmentFilenames.length}`);

	const orgCategories = await ensureDefaultCategories(entity.organizationId);

	let categoryId: string | undefined;
	let categorySlug: string | undefined;
	let entityType = "FEEDBACK";
	let confidence = 0;
	let reasoning = "";
	let extractedFields: Record<string, unknown> = {};

	const useDynamic = orgCategories.length > 0;

	try {
		if (useDynamic) {
			const cats = orgCategories.map((c) => ({
				...c,
				aiPrompt: c.aiPrompt ?? "",
			}));
			const result = await classifyEmailDynamic({ subject, sender, content }, cats);
			categorySlug = result.categorySlug;
			confidence = result.confidence;
			reasoning = result.reasoning;
			const matched = orgCategories.find((c) => c.slug === categorySlug);
			categoryId = matched?.id;
			entityType = SLUG_TO_ENTITY_TYPE[categorySlug] ?? "FEEDBACK";
		} else {
			const result = await classifyEmail({ subject, sender, content });
			entityType = result.type;
			confidence = result.confidence;
			reasoning = result.reasoning;
			categorySlug = result.type.toLowerCase();
		}
		console.info(`${LOG_TAG} Classified entity=${entityId} → ${categorySlug} (${Math.round(confidence * 100)}%)`);
	} catch (err) {
		console.error(`${LOG_TAG} Classification FAILED entity=${entityId}`, {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
			useDynamic,
			contentLength: content.length,
		});
		throw err;
	}

	try {
		if (entityType === "APPROVAL" || categorySlug === "approval") {
			extractedFields = await extractApprovalFields(content);
		} else if (entityType === "REPORT" || categorySlug === "report") {
			extractedFields = await extractReportFields(content);
		}
		console.info(`${LOG_TAG} Extracted entity=${entityId} type=${entityType} fields=${Object.keys(extractedFields).length}`);
	} catch (err) {
		console.error(`${LOG_TAG} Extraction FAILED entity=${entityId} type=${entityType}`, {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		throw err;
	}

	let summary: string;
	try {
		summary = await summarizeThread(content);
		console.info(`${LOG_TAG} Summarized entity=${entityId} length=${summary.length}`);
	} catch (err) {
		console.error(`${LOG_TAG} Summarization FAILED entity=${entityId}`, {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		throw err;
	}

	const isNoise = entityType === "NOISE";
	const validEntityType = (["APPROVAL", "REPORT", "ISSUE", "FEEDBACK"] as const).includes(
		entityType as "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK",
	)
		? (entityType as "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK")
		: "FEEDBACK";

	const isFiltered = isNoise;
	const initialStatus = determineStatus(categorySlug ?? entityType.toLowerCase(), extractedFields);

	await db.flowEntity.update({
		where: { id: entity.id },
		data: {
			type: validEntityType,
			categoryId: categoryId ?? undefined,
			title: (extractedFields as { title?: string }).title ?? entity.title,
			status: initialStatus,
			extractedFields: JSON.stringify(extractedFields),
			aiSummary: summary,
			aiConfidence: confidence,
			requiresReview: confidence < 0.7,
			isFiltered,
			updatedAt: new Date(),
		},
	});

	await db.timelineEvent.create({
		data: {
			entityId: entity.id,
			type: "ai_summary",
			content: `AI classified as ${categorySlug ?? entityType} (${Math.round(confidence * 100)}%): ${summary}`,
			metadata: JSON.stringify({ categorySlug, categoryId, confidence, reasoning, extractedFields }),
		},
	});

	// Multi-project detection: check if this email actually contains 2+ independent
	// sub-projects (e.g. subsidiary monthly report covering several initiatives).
	// We don't auto-split — we surface a "needs decision" timeline event so the user
	// can decide whether to split, keep merged, or focus on one.
	if (!isFiltered && content.length >= 200) {
		try {
			const detection = await detectMultipleProjects({ subject, content });
			if (detection.hasMultipleProjects && detection.subProjects && detection.subProjects.length >= 2) {
				console.info(`${LOG_TAG} Detected ${detection.subProjects.length} sub-projects in entity=${entityId}`);

				// Persist sub-project candidates into extractedFields for UI rendering and Agent tools.
				const mergedFields = {
					...extractedFields,
					subProjects: detection.subProjects,
					subProjectsDetectedAt: new Date().toISOString(),
					subProjectsDecision: null as null | "split" | "merged" | "focused",
				};
				await db.flowEntity.update({
					where: { id: entity.id },
					data: { extractedFields: JSON.stringify(mergedFields) },
				});

				const titles = detection.subProjects.map((p) => p.title).join(" / ");
				await db.timelineEvent.create({
					data: {
						entityId: entity.id,
						type: "needs_user_decision",
						content: `检测到本邮件包含 ${detection.subProjects.length} 个独立子项目：${titles}。是否拆分追踪？`,
						metadata: JSON.stringify({
							kind: "multi_project_split",
							confidence: detection.confidence,
							reasoning: detection.reasoning,
							subProjects: detection.subProjects,
						}),
					},
				});
			}
		} catch (err) {
			console.warn(`${LOG_TAG} multi-project detection failed (non-critical) entity=${entityId}`, err instanceof Error ? err.message : String(err));
		}
	}

	try {
		const tagNames = await generateTags({ subject, content, sender, extractedFields });
		for (const tagName of tagNames) {
			const tag = await db.tag.upsert({
				where: { organizationId_name: { organizationId: entity.organizationId, name: tagName } },
				create: { organizationId: entity.organizationId, name: tagName, source: "AI" },
				update: {},
			});
			await db.entityTag.upsert({
				where: { entityId_tagId: { entityId: entity.id, tagId: tag.id } },
				create: { entityId: entity.id, tagId: tag.id },
				update: {},
			});
		}
	} catch (err) {
		console.warn(`${LOG_TAG} Tags failed (non-critical) entity=${entityId}`, {
			error: err instanceof Error ? err.message : String(err),
		});
	}

	console.info(`${LOG_TAG} Completed entity=${entityId} → ${categorySlug} confidence=${Math.round(confidence * 100)}%`);

	return {
		entityId: entity.id,
		type: validEntityType,
		categorySlug,
		confidence,
		summary,
	};
}

/**
 * Pick the richest text representation of an email thread for AI analysis.
 *
 * For forwarded emails the plain-text body is often empty or contains only
 * headers + signature because the real content lives in an HTML table / div.
 * When bodyText looks too thin we fall back to an HTML→text conversion that
 * preserves more structure.
 */
function extractBestContent(thread: {
	bodyText: string | null;
	bodyHtml: string | null;
	snippet: string | null;
}): string {
	const text = thread.bodyText?.trim() ?? "";
	const meaningfulTextLen = text
		.replace(/[-─=]{3,}[^-─=]*[-─=]{3,}/g, "")
		.replace(/^(发件人|收件人|抄送人?|日期|主题|From|To|Cc|Date|Subject)[：:].+$/gim, "")
		.replace(/\s+/g, " ")
		.trim().length;

	if (meaningfulTextLen > 100) {
		return text;
	}

	if (thread.bodyHtml) {
		const fromHtml = stripHtmlForAI(thread.bodyHtml);
		if (fromHtml.length > meaningfulTextLen) {
			return fromHtml;
		}
	}

	return text || thread.snippet || "";
}

function stripHtmlForAI(html: string): string {
	return html
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, "\n")
		.replace(/<\/td>/gi, "\t")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/gi, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.replace(/&#?\w+;/g, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/**
 * Lightweight classification-only pass. Runs the classifier but skips
 * extraction, summarization, and tag generation. Returns the result
 * without writing to the database so the user can review first.
 */
export async function classifyEntityOnly(entityId: string): Promise<{
	entityId: string;
	title: string;
	categorySlug: string;
	entityType: string;
	confidence: number;
	reasoning: string;
	categoryId?: string;
	sender: string;
	subject: string;
}> {
	const LOG_TAG = "[ClassifyOnly]";

	const entity = await db.flowEntity.findUnique({
		where: { id: entityId },
		include: {
			threads: {
				select: {
					subject: true,
					sender: true,
					senderName: true,
					bodyText: true,
					bodyHtml: true,
					snippet: true,
				},
				orderBy: { receivedAt: "desc" },
				take: 3,
			},
		},
	});

	if (!entity) {
		throw new Error(`Entity ${entityId} not found`);
	}
	if (entity.threads.length === 0) {
		throw new Error(`Entity ${entityId} has no threads`);
	}

	const primaryThread = entity.threads[0];
	let content = extractBestContent(primaryThread);
	const subject = primaryThread.subject ?? entity.title;
	const sender = primaryThread.senderName ?? primaryThread.sender ?? "";

	try {
		const { text: attachmentText } = await readEntityAttachments(entityId);
		if (attachmentText) {
			content = content ? `${content}\n\n${attachmentText}` : attachmentText;
		}
	} catch {
		// non-critical
	}

	console.info(`${LOG_TAG} entity=${entityId} subject="${subject.slice(0, 60)}" contentLen=${content.length}`);

	const orgCategories = await ensureDefaultCategories(entity.organizationId);

	let categoryId: string | undefined;
	let categorySlug = "unknown";
	let entityType = "FEEDBACK";
	let confidence = 0;
	let reasoning = "";

	if (orgCategories.length > 0) {
		const cats = orgCategories.map((c) => ({ ...c, aiPrompt: c.aiPrompt ?? "" }));
		const result = await classifyEmailDynamic({ subject, sender, content }, cats);
		categorySlug = result.categorySlug;
		confidence = result.confidence;
		reasoning = result.reasoning;
		categoryId = orgCategories.find((c) => c.slug === categorySlug)?.id;
		entityType = SLUG_TO_ENTITY_TYPE[categorySlug] ?? "FEEDBACK";
	} else {
		const result = await classifyEmail({ subject, sender, content });
		entityType = result.type;
		confidence = result.confidence;
		reasoning = result.reasoning;
		categorySlug = result.type.toLowerCase();
	}

	console.info(`${LOG_TAG} Result entity=${entityId} → ${categorySlug} (${Math.round(confidence * 100)}%)`);

	return {
		entityId: entity.id,
		title: entity.title,
		categorySlug,
		entityType,
		confidence,
		reasoning,
		categoryId,
		sender,
		subject,
	};
}

function determineStatus(slug: string, fields: Record<string, unknown>): string {
	switch (slug) {
		case "approval":
			return "pending";
		case "report": {
			const s = (fields as { overallStatus?: string }).overallStatus;
			return s === "blocked" ? "blocked" : "in_progress";
		}
		case "issue":
			return "open";
		case "feedback":
			return "received";
		case "noise":
			return "filtered";
		default:
			return "pending";
	}
}
