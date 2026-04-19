import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { getSignedUrl } from "@repo/storage";
import { z } from "zod";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

function isStorageEnabled() {
	return !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID);
}

export interface AttachmentToolDeps {
	/**
	 * PDF 文本极少时调用此函数走 OCR。由 web 层注入避免循环依赖。
	 * 返回结构需含 text 与可选 successCount/pageCount。
	 */
	ocrPdfBuffer?: (
		buffer: Buffer,
	) => Promise<{ text: string; successCount?: number; pageCount?: number }>;
}

export function createAttachmentTools(deps?: AttachmentToolDeps) {
	return {
		list_attachments: tool({
			description:
				"列出指定事项或邮件线程的所有附件（文件名、类型、大小）。用户问【有没有附件】【这封邮件里有什么文件】【给我看看附件】时调用。返回 hasContent 字段表示文件是否可以被读取。",
			inputSchema: z.object({
				entityId: z
					.string()
					.optional()
					.describe("事项 ID，优先用上下文中的 entity ID"),
				threadId: z
					.string()
					.optional()
					.describe("邮件线程 ID，可替代 entityId"),
			}),
			execute: async (input: {
				entityId?: string;
				threadId?: string;
			}) => {
				let threadIds: string[] = input.threadId ? [input.threadId] : [];

				if (input.entityId && !input.threadId) {
					const threads = await db.emailThread.findMany({
						where: { entityId: input.entityId },
						select: { id: true },
					});
					threadIds = threads.map((t) => t.id);
				}

				if (threadIds.length === 0) {
					return { count: 0, attachments: [], message: "未找到关联邮件线程" };
				}

				const attachments = await db.emailAttachment.findMany({
					where: { threadId: { in: threadIds } },
					include: {
						thread: { select: { subject: true, entityId: true } },
					},
					orderBy: { createdAt: "desc" },
				});

				const result = await Promise.all(
					attachments.map(async (att) => {
						let downloadUrl: string | null = null;
						if (att.storageKey && isStorageEnabled()) {
							try {
								downloadUrl = await getSignedUrl(att.storageKey, {
									bucket: "attachments",
									expiresIn: 3600,
								});
							} catch {
								// ignore
							}
						}
						return {
							id: att.id,
							filename: att.filename,
							mimeType: att.mimeType,
							size: att.size,
							hasContent: !!att.storageKey,
							downloadUrl,
							threadSubject: att.thread.subject,
						};
					}),
				);

				return { count: result.length, attachments: result };
			},
		}),

		read_attachment: tool({
			description:
				"读取附件的文字内容。支持 PDF、Word（.docx/.doc）、Excel（.xlsx/.xls/.csv）、纯文本。图片类型返回下载链接。用户问【帮我看看这个 PDF 说了什么】【读一下附件内容】【分析这份合同】【这个表格里有什么数据】时调用。需要先用 list_attachments 拿到 attachment ID。",
			inputSchema: z.object({
				attachmentId: z.string().describe("从 list_attachments 结果中获取的附件 ID"),
			}),
			execute: async (input: { attachmentId: string }) => {
				const attachment = await db.emailAttachment.findUnique({
					where: { id: input.attachmentId },
					include: {
						thread: {
							select: { subject: true, entityId: true, organizationId: true },
						},
					},
				});

				if (!attachment) {
					return { error: "附件不存在" };
				}

				if (!attachment.storageKey) {
					return {
						filename: attachment.filename,
						mimeType: attachment.mimeType,
						status: "not_stored",
						message:
							"此附件在存储功能上线前接收，文件内容不可读取。请让发件人重新转发。",
					};
				}

				if (!isStorageEnabled()) {
					return { status: "storage_not_configured", message: "存储服务未配置" };
				}

				let downloadUrl: string;
				try {
					downloadUrl = await getSignedUrl(attachment.storageKey, {
						bucket: "attachments",
						expiresIn: 300,
					});
				} catch {
					return { error: "无法生成下载链接" };
				}

				const mime = attachment.mimeType ?? "";
				const filename = attachment.filename ?? "";
				const isImage = mime.startsWith("image/");
				const isPdf =
					mime === "application/pdf" ||
					filename.toLowerCase().endsWith(".pdf");
				const isText =
					mime.startsWith("text/") || mime === "application/json";
				const isWord =
					mime.includes("wordprocessingml") ||
					mime.includes("msword") ||
					mime.includes("word") ||
					filename.toLowerCase().endsWith(".docx") ||
					filename.toLowerCase().endsWith(".doc");
				const isExcel =
					mime.includes("spreadsheetml") ||
					mime.includes("ms-excel") ||
					mime === "text/csv" ||
					filename.toLowerCase().endsWith(".xlsx") ||
					filename.toLowerCase().endsWith(".xls") ||
					filename.toLowerCase().endsWith(".csv");

				if (isImage) {
					return {
						filename: attachment.filename,
						mimeType: mime,
						type: "image",
						downloadUrl,
						message: "这是图片附件，无法提取文字。下载链接已提供，可用视觉模型分析。",
					};
				}

				// Fetch and parse
				try {
					const fileRes = await fetch(downloadUrl);
					if (!fileRes.ok) {
						throw new Error(`HTTP ${fileRes.status}`);
					}
					const buf = Buffer.from(await fileRes.arrayBuffer());

					let content: string;

					if (isText) {
						content = buf.toString("utf-8");
					} else if (isPdf) {
						let pdfText = "";
						try {
							const parsed = await pdfParse(buf);
							pdfText = parsed.text ?? "";
						} catch (parseErr) {
							console.warn(
								`[read_attachment] pdf-parse failed for ${filename}:`,
								parseErr instanceof Error ? parseErr.message : String(parseErr),
							);
						}
						const looksImageBased = pdfText.trim().length < 50;
						if (looksImageBased && deps?.ocrPdfBuffer) {
							try {
								const ocr = await deps.ocrPdfBuffer(buf);
								if (ocr.text) {
									const meta =
										ocr.successCount !== undefined && ocr.pageCount !== undefined
											? `[OCR 识别 ${ocr.successCount}/${ocr.pageCount} 页]\n\n`
											: "[OCR 识别]\n\n";
									content = `${meta}${ocr.text}`;
								} else {
									content = pdfText || "[PDF 为图片型且 OCR 未能识别出文字]";
								}
							} catch (ocrErr) {
								console.warn(
									`[read_attachment] OCR failed for ${filename}:`,
									ocrErr instanceof Error ? ocrErr.message : String(ocrErr),
								);
								content = pdfText || "[PDF 解析失败]";
							}
						} else {
							content = pdfText || "[PDF 解析成功但无文字内容；可配置 ZHIPU_API_KEY 启用 OCR]";
						}
					} else if (isWord) {
						const result = await mammoth.extractRawText({ buffer: buf });
						content = result.value || "[Word 文档解析成功但无文字内容]";
					} else if (isExcel) {
						const workbook = XLSX.read(buf, { type: "buffer" });
						const parts: string[] = [];
						for (const sheetName of workbook.SheetNames) {
							const sheet = workbook.Sheets[sheetName];
							if (!sheet) { continue; }
							const csv = XLSX.utils.sheet_to_csv(sheet);
							const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
							parts.push(`## Sheet: ${sheetName} (${jsonData.length} 行)`);
							parts.push(csv);
						}
						content = parts.join("\n\n") || "[Excel 解析成功但无数据]";
					} else {
						return {
							filename: attachment.filename,
							mimeType: mime,
							type: "unsupported",
							downloadUrl,
							message: `不支持解析 ${mime} 格式，下载链接已提供。`,
						};
					}

					const truncated = content.length > 50000;
					return {
						filename: attachment.filename,
						mimeType: mime,
						threadSubject: attachment.thread.subject,
						entityId: attachment.thread.entityId,
						contentLength: content.length,
						truncated,
						content: content.slice(0, 50000),
					};
				} catch (err) {
					return {
						error: "文件读取失败",
						message: err instanceof Error ? err.message : String(err),
						downloadUrl,
					};
				}
			},
		}),

		read_attachments_batch: tool({
			description:
				"批量读取多个附件的文字内容（PDF/Word/Excel/文本）。当用户问【分析所有附件】【读取这个事项的全部 PDF】【对比多份报告】时使用，避免逐个调用 read_attachment 浪费 step。最多一次读 20 个；每个超大附件内容会被截断到 10000 字以节省上下文。",
			inputSchema: z.object({
				attachmentIds: z
					.array(z.string())
					.min(1)
					.max(20)
					.describe("从 list_attachments 拿到的附件 ID 列表，最多 20 个"),
				perItemCharLimit: z
					.number()
					.int()
					.min(500)
					.max(50_000)
					.optional()
					.default(10_000)
					.describe("每个附件返回的最大字符数，默认 10000，多附件场景建议保持默认"),
			}),
			execute: async (input: {
				attachmentIds: string[];
				perItemCharLimit?: number;
			}) => {
				const limit = input.perItemCharLimit ?? 10_000;
				if (!isStorageEnabled()) {
					return {
						status: "storage_not_configured",
						message: "存储服务未配置",
					};
				}

				const attachments = await db.emailAttachment.findMany({
					where: { id: { in: input.attachmentIds } },
					include: {
						thread: {
							select: {
								subject: true,
								entityId: true,
								organizationId: true,
							},
						},
					},
				});

				const byId = new Map(attachments.map((a) => [a.id, a]));

				const results = await Promise.all(
					input.attachmentIds.map(async (attId) => {
						const attachment = byId.get(attId);
						if (!attachment) {
							return { attachmentId: attId, error: "附件不存在" };
						}
						if (!attachment.storageKey) {
							return {
								attachmentId: attId,
								filename: attachment.filename,
								status: "not_stored",
								message:
									"此附件在存储功能上线前接收，文件内容不可读取",
							};
						}

						let downloadUrl: string;
						try {
							downloadUrl = await getSignedUrl(attachment.storageKey, {
								bucket: "attachments",
								expiresIn: 600,
							});
						} catch {
							return {
								attachmentId: attId,
								filename: attachment.filename,
								error: "无法生成下载链接",
							};
						}

						const mime = attachment.mimeType ?? "";
						const filename = attachment.filename ?? "";
						const lower = filename.toLowerCase();
						const isImage = mime.startsWith("image/");
						const isPdf =
							mime === "application/pdf" || lower.endsWith(".pdf");
						const isText =
							mime.startsWith("text/") || mime === "application/json";
						const isWord =
							mime.includes("wordprocessingml") ||
							mime.includes("msword") ||
							mime.includes("word") ||
							lower.endsWith(".docx") ||
							lower.endsWith(".doc");
						const isExcel =
							mime.includes("spreadsheetml") ||
							mime.includes("ms-excel") ||
							mime === "text/csv" ||
							lower.endsWith(".xlsx") ||
							lower.endsWith(".xls") ||
							lower.endsWith(".csv");

						if (isImage) {
							return {
								attachmentId: attId,
								filename,
								type: "image",
								message: "图片附件，未读取文字",
								downloadUrl,
							};
						}

						try {
							const fileRes = await fetch(downloadUrl);
							if (!fileRes.ok) {
								throw new Error(`HTTP ${fileRes.status}`);
							}
							const buf = Buffer.from(await fileRes.arrayBuffer());

							let content: string;
							let extractor: string;

							if (isText) {
								content = buf.toString("utf-8");
								extractor = "text";
							} else if (isPdf) {
								let pdfText = "";
								try {
									const parsed = await pdfParse(buf);
									pdfText = parsed.text ?? "";
								} catch {
									// fall through
								}
								const looksImageBased = pdfText.trim().length < 50;
								if (looksImageBased && deps?.ocrPdfBuffer) {
									try {
										const ocr = await deps.ocrPdfBuffer(buf);
										if (ocr.text) {
											const meta =
												ocr.successCount !== undefined &&
												ocr.pageCount !== undefined
													? `[OCR ${ocr.successCount}/${ocr.pageCount} 页]\n\n`
													: "[OCR]\n\n";
											content = `${meta}${ocr.text}`;
											extractor = "pdf+ocr";
										} else {
											content =
												pdfText || "[PDF 为图片型且 OCR 未识别出文字]";
											extractor = "pdf+ocr_empty";
										}
									} catch (ocrErr) {
										content = pdfText || "[PDF 解析失败]";
										extractor = "pdf+ocr_error";
										console.warn(
											`[read_attachments_batch] OCR failed for ${filename}:`,
											ocrErr instanceof Error
												? ocrErr.message
												: String(ocrErr),
										);
									}
								} else {
									content =
										pdfText ||
										"[PDF 解析成功但无文字；可配置 ZHIPU_API_KEY 启用 OCR]";
									extractor = "pdf";
								}
							} else if (isWord) {
								const result = await mammoth.extractRawText({ buffer: buf });
								content = result.value || "[Word 无文字内容]";
								extractor = "word";
							} else if (isExcel) {
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
								content = parts.join("\n\n") || "[Excel 无数据]";
								extractor = "excel";
							} else {
								return {
									attachmentId: attId,
									filename,
									mimeType: mime,
									type: "unsupported",
									downloadUrl,
									message: `不支持解析 ${mime} 格式`,
								};
							}

							const truncated = content.length > limit;
							return {
								attachmentId: attId,
								filename,
								mimeType: mime,
								threadSubject: attachment.thread.subject,
								extractor,
								contentLength: content.length,
								truncated,
								content: content.slice(0, limit),
							};
						} catch (err) {
							return {
								attachmentId: attId,
								filename,
								error: "文件读取失败",
								message: err instanceof Error ? err.message : String(err),
								downloadUrl,
							};
						}
					}),
				);

				const okCount = results.filter(
					(r) => "content" in r && typeof r.content === "string",
				).length;

				return {
					requested: input.attachmentIds.length,
					readSuccess: okCount,
					perItemCharLimit: limit,
					results,
				};
			},
		}),
	};
}
