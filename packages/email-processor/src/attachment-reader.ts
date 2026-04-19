import { db } from "@repo/database";
import { getSignedUrl } from "@repo/storage";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { isZhipuOcrConfigured, ocrPdfBuffer } from "./ocr";

/** PDF 文本字数低于该阈值则视为图片型 PDF，触发 OCR 回退 */
const PDF_OCR_FALLBACK_MIN_CHARS = 50;

function isStorageEnabled() {
	return !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID);
}

const PARSEABLE_MIMES = new Set([
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"text/csv",
	"text/plain",
	"application/json",
]);

function isParseableFile(filename: string, mimeType: string | null): boolean {
	if (mimeType && PARSEABLE_MIMES.has(mimeType)) {
		return true;
	}
	const lower = filename.toLowerCase();
	return /\.(pdf|docx?|xlsx?|csv|txt|json)$/.test(lower);
}

export interface AttachmentReadDetail {
	filename: string;
	chars: number;
	ocrUsed: boolean;
	error?: string;
}

export interface AttachmentReadResult {
	text: string;
	filenames: string[];
	details: AttachmentReadDetail[];
	totalParseable: number;
	skipped: number;
}

/**
 * Read text content from attachments linked to an entity.
 * Returns concatenated text from all parseable attachments (PDF, Word, Excel, text).
 * Caps total output at `maxChars` to avoid blowing up AI context.
 */
export async function readEntityAttachments(
	entityId: string,
	maxChars = 8000,
): Promise<AttachmentReadResult> {
	const empty: AttachmentReadResult = {
		text: "",
		filenames: [],
		details: [],
		totalParseable: 0,
		skipped: 0,
	};
	if (!isStorageEnabled()) {
		return empty;
	}

	const threads = await db.emailThread.findMany({
		where: { entityId },
		select: { id: true },
	});

	if (threads.length === 0) {
		return empty;
	}

	const attachments = await db.emailAttachment.findMany({
		where: {
			threadId: { in: threads.map((t) => t.id) },
			storageKey: { not: null },
		},
		orderBy: { createdAt: "asc" },
	});

	const parseable = attachments.filter((a) =>
		isParseableFile(a.filename, a.mimeType),
	);

	if (parseable.length === 0) {
		return empty;
	}

	const parts: string[] = [];
	const filenames: string[] = [];
	const details: AttachmentReadDetail[] = [];
	let totalLen = 0;
	let skipped = 0;

	for (const att of parseable) {
		if (totalLen >= maxChars) {
			skipped += 1;
			continue;
		}

		// 缓存命中：直接用 extractedText，不再跑 OCR / pdf-parse
		if (att.extractedText && att.extractedText.length > 0) {
			const remaining = maxChars - totalLen;
			const chunk =
				att.extractedText.length > remaining
					? att.extractedText.slice(0, remaining)
					: att.extractedText;
			parts.push(`[附件: ${att.filename}]\n${chunk}`);
			filenames.push(att.filename);
			details.push({
				filename: att.filename,
				chars: chunk.length,
				ocrUsed: att.extractedBy === "pdf+ocr",
			});
			totalLen += chunk.length;
			continue;
		}

		// 之前失败过：跳过避免反复重试
		if (att.extractError) {
			details.push({
				filename: att.filename,
				chars: 0,
				ocrUsed: false,
				error: `cached: ${att.extractError}`,
			});
			continue;
		}

		try {
			const result = await extractFileText(
				att.storageKey as string,
				att.filename,
				att.mimeType,
			);
			if (result?.content) {
				// 落库供下次秒读 + 给 agent batch 工具复用
				try {
					await db.emailAttachment.update({
						where: { id: att.id },
						data: {
							extractedText: result.content,
							extractedBy: result.ocrUsed
								? "pdf+ocr"
								: pickExtractor(att.filename, att.mimeType),
							extractedAt: new Date(),
							extractError: null,
						},
					});
				} catch (persistErr) {
					console.warn(
						`[AttachmentReader] persist failed for ${att.filename}:`,
						persistErr instanceof Error
							? persistErr.message
							: String(persistErr),
					);
				}

				const remaining = maxChars - totalLen;
				const chunk =
					result.content.length > remaining
						? result.content.slice(0, remaining)
						: result.content;
				parts.push(`[附件: ${att.filename}]\n${chunk}`);
				filenames.push(att.filename);
				details.push({
					filename: att.filename,
					chars: chunk.length,
					ocrUsed: result.ocrUsed,
				});
				totalLen += chunk.length;
			} else {
				// 空结果也记一下，避免反复尝试
				try {
					await db.emailAttachment.update({
						where: { id: att.id },
						data: {
							extractError: "empty",
							extractedAt: new Date(),
						},
					});
				} catch {}
				details.push({
					filename: att.filename,
					chars: 0,
					ocrUsed: false,
					error: "empty",
				});
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.warn(`[AttachmentReader] Failed to parse ${att.filename}:`, msg);
			try {
				await db.emailAttachment.update({
					where: { id: att.id },
					data: {
						extractError: msg.slice(0, 500),
						extractedAt: new Date(),
					},
				});
			} catch {}
			details.push({
				filename: att.filename,
				chars: 0,
				ocrUsed: false,
				error: msg.slice(0, 120),
			});
		}
	}

	return {
		text: parts.join("\n\n"),
		filenames,
		details,
		totalParseable: parseable.length,
		skipped,
	};
}

interface ExtractedFile {
	content: string | null;
	ocrUsed: boolean;
}

function pickExtractor(filename: string, mimeType: string | null): string {
	const mime = mimeType ?? "";
	const lower = filename.toLowerCase();
	if (mime === "application/pdf" || lower.endsWith(".pdf")) {
		return "pdf";
	}
	if (
		mime.includes("wordprocessingml") ||
		mime.includes("msword") ||
		lower.endsWith(".docx") ||
		lower.endsWith(".doc")
	) {
		return "word";
	}
	if (
		mime.includes("spreadsheetml") ||
		mime.includes("ms-excel") ||
		lower.endsWith(".xlsx") ||
		lower.endsWith(".xls")
	) {
		return "excel";
	}
	return "text";
}

async function extractFileText(
	storageKey: string,
	filename: string,
	mimeType: string | null,
): Promise<ExtractedFile | null> {
	const url = await getSignedUrl(storageKey, {
		bucket: "attachments",
		expiresIn: 300,
	});

	const res = await fetch(url);
	if (!res.ok) {
		return null;
	}
	const buf = Buffer.from(await res.arrayBuffer());

	const mime = mimeType ?? "";
	const lower = filename.toLowerCase();

	if (mime.startsWith("text/") || mime === "application/json" || lower.endsWith(".txt") || lower.endsWith(".csv") || lower.endsWith(".json")) {
		return { content: buf.toString("utf-8"), ocrUsed: false };
	}

	if (mime === "application/pdf" || lower.endsWith(".pdf")) {
		let parsedText = "";
		try {
			const parsed = await pdfParse(buf);
			parsedText = parsed.text ?? "";
		} catch (err) {
			console.warn(
				`[AttachmentReader] pdf-parse failed for ${filename}, will try OCR:`,
				err instanceof Error ? err.message : String(err),
			);
		}

		if (parsedText.trim().length >= PDF_OCR_FALLBACK_MIN_CHARS) {
			return { content: parsedText, ocrUsed: false };
		}

		if (isZhipuOcrConfigured()) {
			try {
				const ocr = await ocrPdfBuffer(buf, { maxPages: 10, viewportScale: 2 });
				if (ocr.text) {
					console.log(
						`[AttachmentReader] OCR success for ${filename}: ${ocr.successCount}/${ocr.pageCount} pages, ${ocr.text.length} chars`,
					);
					return { content: ocr.text, ocrUsed: true };
				}
				if (ocr.errors.length > 0) {
					console.warn(
						`[AttachmentReader] OCR failed for ${filename}:`,
						ocr.errors.slice(0, 3),
					);
				}
			} catch (err) {
				console.warn(
					`[AttachmentReader] OCR threw for ${filename}:`,
					err instanceof Error ? err.message : String(err),
				);
			}
		}

		return parsedText ? { content: parsedText, ocrUsed: false } : null;
	}

	if (mime.includes("wordprocessingml") || mime.includes("msword") || lower.endsWith(".docx") || lower.endsWith(".doc")) {
		const result = await mammoth.extractRawText({ buffer: buf });
		return result.value ? { content: result.value, ocrUsed: false } : null;
	}

	if (mime.includes("spreadsheetml") || mime.includes("ms-excel") || lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
		const workbook = XLSX.read(buf, { type: "buffer" });
		const parts: string[] = [];
		for (const sheetName of workbook.SheetNames) {
			const sheet = workbook.Sheets[sheetName];
			if (!sheet) {
				continue;
			}
			const csv = XLSX.utils.sheet_to_csv(sheet);
			parts.push(`## Sheet: ${sheetName}\n${csv}`);
		}
		const joined = parts.join("\n\n");
		return joined ? { content: joined, ocrUsed: false } : null;
	}

	return null;
}

/**
 * 给一批 threads 预热附件 OCR/文本提取并落库（extractedText）。
 * 缓存命中的跳过，previously-failed 的跳过；新提取的写库供后续秒读。
 *
 * 用于 per-email AI 提炼 / agent 工具批量分析前的预处理：
 * 一次跑完所有 PDF OCR，让后续每封邮件分析直接命中缓存。
 *
 * 并发控制 = 2（OCR+网络重，再多容易撑爆 stream/限速）。
 */
export async function preheatAttachmentsForThreads(
	threadIds: string[],
	options?: { perFileTimeoutMs?: number; concurrency?: number },
): Promise<{ total: number; cached: number; freshExtracted: number; failed: number }> {
	if (!isStorageEnabled() || threadIds.length === 0) {
		return { total: 0, cached: 0, freshExtracted: 0, failed: 0 };
	}

	const timeout = options?.perFileTimeoutMs ?? 90_000;
	const concurrency = options?.concurrency ?? 2;

	const attachments = await db.emailAttachment.findMany({
		where: {
			threadId: { in: threadIds },
			storageKey: { not: null },
		},
		orderBy: { createdAt: "asc" },
	});

	const parseable = attachments.filter((a) =>
		isParseableFile(a.filename, a.mimeType),
	);

	let cached = 0;
	let freshExtracted = 0;
	let failed = 0;

	const todo = parseable.filter((att) => {
		if (att.extractedText && att.extractedText.length > 0) {
			cached += 1;
			return false;
		}
		if (att.extractError) {
			// 之前失败过，跳过避免反复重试
			failed += 1;
			return false;
		}
		return true;
	});

	if (todo.length === 0) {
		return { total: parseable.length, cached, freshExtracted: 0, failed };
	}

	let cursor = 0;
	async function worker() {
		while (true) {
			const idx = cursor++;
			if (idx >= todo.length) {
				return;
			}
			const att = todo[idx];
			try {
				const result = await Promise.race<ExtractedFile | null | never>([
					extractFileText(
						att.storageKey as string,
						att.filename,
						att.mimeType,
					),
					new Promise((_, reject) =>
						setTimeout(
							() => reject(new Error("PREHEAT_TIMEOUT")),
							timeout,
						),
					),
				]);

				if (result?.content) {
					await db.emailAttachment.update({
						where: { id: att.id },
						data: {
							extractedText: result.content,
							extractedBy: result.ocrUsed
								? "pdf+ocr"
								: pickExtractor(att.filename, att.mimeType),
							extractedAt: new Date(),
							extractError: null,
						},
					});
					freshExtracted += 1;
				} else {
					await db.emailAttachment.update({
						where: { id: att.id },
						data: {
							extractError: "empty",
							extractedAt: new Date(),
						},
					});
					failed += 1;
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.warn(
					`[AttachmentReader] preheat failed for ${att.filename}: ${msg}`,
				);
				try {
					await db.emailAttachment.update({
						where: { id: att.id },
						data: {
							extractError: msg.slice(0, 500),
							extractedAt: new Date(),
						},
					});
				} catch {}
				failed += 1;
			}
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(concurrency, todo.length) }, worker),
	);

	return { total: parseable.length, cached, freshExtracted, failed };
}
