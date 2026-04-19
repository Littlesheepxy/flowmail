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

/**
 * Read text content from attachments linked to an entity.
 * Returns concatenated text from all parseable attachments (PDF, Word, Excel, text).
 * Caps total output at `maxChars` to avoid blowing up AI context.
 */
export async function readEntityAttachments(
	entityId: string,
	maxChars = 8000,
): Promise<{ text: string; filenames: string[] }> {
	if (!isStorageEnabled()) {
		return { text: "", filenames: [] };
	}

	const threads = await db.emailThread.findMany({
		where: { entityId },
		select: { id: true },
	});

	if (threads.length === 0) {
		return { text: "", filenames: [] };
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
		return { text: "", filenames: [] };
	}

	const parts: string[] = [];
	const filenames: string[] = [];
	let totalLen = 0;

	for (const att of parseable) {
		if (totalLen >= maxChars) {
			break;
		}
		try {
			const content = await extractFileText(att.storageKey as string, att.filename, att.mimeType);
			if (content) {
				const remaining = maxChars - totalLen;
				const chunk = content.length > remaining ? content.slice(0, remaining) : content;
				parts.push(`[附件: ${att.filename}]\n${chunk}`);
				filenames.push(att.filename);
				totalLen += chunk.length;
			}
		} catch (err) {
			console.warn(`[AttachmentReader] Failed to parse ${att.filename}:`, err instanceof Error ? err.message : String(err));
		}
	}

	return { text: parts.join("\n\n"), filenames };
}

async function extractFileText(
	storageKey: string,
	filename: string,
	mimeType: string | null,
): Promise<string | null> {
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
		return buf.toString("utf-8");
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
			return parsedText;
		}

		// 文本极少 → 大概率是扫描件/图片型 PDF，走 OCR
		if (isZhipuOcrConfigured()) {
			try {
				const ocr = await ocrPdfBuffer(buf, { maxPages: 10, viewportScale: 2 });
				if (ocr.text) {
					console.log(
						`[AttachmentReader] OCR success for ${filename}: ${ocr.successCount}/${ocr.pageCount} pages, ${ocr.text.length} chars`,
					);
					return ocr.text;
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

		return parsedText || null;
	}

	if (mime.includes("wordprocessingml") || mime.includes("msword") || lower.endsWith(".docx") || lower.endsWith(".doc")) {
		const result = await mammoth.extractRawText({ buffer: buf });
		return result.value || null;
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
		return parts.join("\n\n") || null;
	}

	return null;
}
