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
				"批量读取多个附件的文字内容（PDF/Word/Excel/文本）。优先返回数据库里已缓存的提取结果（瞬时），没缓存的会现场跑 pdf-parse / OCR 并落库。当用户问【分析所有附件】【读取这个事项的全部 PDF】【对比多份报告】时使用，避免逐个调用 read_attachment 浪费 step。最多一次读 20 个；每个附件按 perItemCharLimit 截断（默认 10000 字）。",
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
					.describe("每个附件返回的最大字符数，默认 10000"),
				forceRefresh: z
					.boolean()
					.optional()
					.default(false)
					.describe("true=忽略缓存重新解析；默认 false 只在没缓存时跑"),
			}),
			execute: async (input: {
				attachmentIds: string[];
				perItemCharLimit?: number;
				forceRefresh?: boolean;
			}) => {
				const limit = input.perItemCharLimit ?? 10_000;
				const forceRefresh = input.forceRefresh ?? false;
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

				// 单个附件提取（含缓存读 / 现场解析 / 落库 / 超时保护）
				async function extractOne(attId: string) {
					const attachment = byId.get(attId);
					if (!attachment) {
						return { attachmentId: attId, error: "附件不存在" };
					}
					const filename = attachment.filename ?? "";

					// 缓存命中：直接返回（这是治本的优化路径）
					if (
						!forceRefresh &&
						attachment.extractedText &&
						attachment.extractedText.length > 0
					) {
						const cached = attachment.extractedText;
						const truncated = cached.length > limit;
						return {
							attachmentId: attId,
							filename,
							mimeType: attachment.mimeType ?? null,
							threadSubject: attachment.thread.subject,
							extractor: attachment.extractedBy ?? "cache",
							source: "cache" as const,
							contentLength: cached.length,
							truncated,
							content: cached.slice(0, limit),
						};
					}

					if (!attachment.storageKey) {
						return {
							attachmentId: attId,
							filename,
							status: "not_stored",
							message:
								"此附件在存储功能上线前接收，文件内容不可读取",
						};
					}

					// 已经尝试过且失败的，跳过避免反复尝试（除非 forceRefresh）
					if (!forceRefresh && attachment.extractError) {
						return {
							attachmentId: attId,
							filename,
							error: "previously_failed",
							message: attachment.extractError,
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
							filename,
							error: "无法生成下载链接",
						};
					}

					const mime = attachment.mimeType ?? "";
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

					// 包一层 90s 超时，单文件失败不拖死整个 batch
					const EXTRACT_TIMEOUT_MS = 90_000;

					async function persist(opts: {
						content: string;
						extractor: string;
					}) {
						try {
							await db.emailAttachment.update({
								where: { id: attId },
								data: {
									extractedText: opts.content,
									extractedBy: opts.extractor,
									extractedAt: new Date(),
									extractError: null,
								},
							});
						} catch (err) {
							console.warn(
								`[read_attachments_batch] persist failed for ${filename}:`,
								err instanceof Error ? err.message : String(err),
							);
						}
					}

					async function persistError(msg: string) {
						try {
							await db.emailAttachment.update({
								where: { id: attId },
								data: {
									extractError: msg.slice(0, 500),
									extractedAt: new Date(),
								},
							});
						} catch {
							// ignore
						}
					}

					async function doExtract() {
						const fileRes = await fetch(downloadUrl);
						if (!fileRes.ok) {
							throw new Error(`HTTP ${fileRes.status}`);
						}
						const buf = Buffer.from(await fileRes.arrayBuffer());

						let content = "";
						let extractor = "";

						if (isText) {
							content = buf.toString("utf-8");
							extractor = "text";
						} else if (isPdf) {
							let pdfText = "";
							try {
								const parsed = await pdfParse(buf);
								pdfText = parsed.text ?? "";
							} catch {
								// will try OCR if image-based
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
											pdfText ||
											"[PDF 为图片型且 OCR 未识别出文字]";
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
							const result = await mammoth.extractRawText({
								buffer: buf,
							});
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
							return null;
						}

						return { content, extractor };
					}

					try {
						const extracted = await Promise.race<
							| { content: string; extractor: string }
							| null
							| never
						>([
							doExtract(),
							new Promise((_, reject) =>
								setTimeout(
									() => reject(new Error("EXTRACT_TIMEOUT")),
									EXTRACT_TIMEOUT_MS,
								),
							),
						]);

						if (!extracted) {
							return {
								attachmentId: attId,
								filename,
								mimeType: mime,
								type: "unsupported",
								downloadUrl,
								message: `不支持解析 ${mime} 格式`,
							};
						}

						// 落库（不阻塞返回值，让下次直接命中缓存）
						void persist(extracted);

						const truncated = extracted.content.length > limit;
						return {
							attachmentId: attId,
							filename,
							mimeType: mime,
							threadSubject: attachment.thread.subject,
							extractor: extracted.extractor,
							source: "fresh" as const,
							contentLength: extracted.content.length,
							truncated,
							content: extracted.content.slice(0, limit),
						};
					} catch (err) {
						const msg =
							err instanceof Error ? err.message : String(err);
						const isTimeout = msg === "EXTRACT_TIMEOUT";
						console.warn(
							`[read_attachments_batch] extract failed for ${filename}: ${msg}`,
						);
						void persistError(isTimeout ? "提取超时（>90s）" : msg);
						return {
							attachmentId: attId,
							filename,
							error: isTimeout ? "extract_timeout" : "文件读取失败",
							message: isTimeout
								? "单文件解析超过 90 秒，已跳过；可下载链接手工查看。"
								: msg,
							downloadUrl,
						};
					}
				}

				// 并发限制：同时最多 2 个（OCR/网络都是 CPU+IO 重负载，并发太高会让 stream 长时间无心跳，
				// agent route 那边会被认为 network error）
				const MAX_CONCURRENCY = 2;
				const results: Array<Awaited<ReturnType<typeof extractOne>>> =
					new Array(input.attachmentIds.length);
				let cursor = 0;
				async function worker() {
					while (true) {
						const idx = cursor++;
						if (idx >= input.attachmentIds.length) {
							return;
						}
						results[idx] = await extractOne(input.attachmentIds[idx]);
					}
				}
				await Promise.all(
					Array.from({ length: Math.min(MAX_CONCURRENCY, input.attachmentIds.length) }, worker),
				);

				const okCount = results.filter(
					(r) => r && "content" in r && typeof (r as { content?: unknown }).content === "string",
				).length;
				const cacheHits = results.filter(
					(r) => r && (r as { source?: string }).source === "cache",
				).length;

				return {
					requested: input.attachmentIds.length,
					readSuccess: okCount,
					cacheHits,
					perItemCharLimit: limit,
					results,
				};
			},
		}),

		check_attachment_ocr_status: tool({
			description:
				"【关键路径必调】查看一个事项下所有附件的解析状态：哪些已经有文字（cached）、哪些是图片型 PDF 还没 OCR（needsOcr）、哪些之前失败了（failed）。在调用 analyze_each_email 之前必须先调本工具——如果有 needsOcr 的附件，先告诉用户，让用户决定是否要 OCR；用户同意后调 ocr_pending_attachments，然后再 analyze_each_email。这样用户能看到 OCR 进度，不会黑屏。",
			inputSchema: z.object({
				entityId: z.string().describe("事项 ID"),
			}),
			execute: async (input: { entityId: string }) => {
				if (!isStorageEnabled()) {
					return {
						status: "storage_not_configured",
						message: "存储服务未配置，附件不可读",
					};
				}
				const threads = await db.emailThread.findMany({
					where: { entityId: input.entityId },
					select: { id: true },
				});
				if (threads.length === 0) {
					return {
						status: "no_threads",
						message: "事项下没有邮件线程",
					};
				}
				const attachments = await db.emailAttachment.findMany({
					where: {
						threadId: { in: threads.map((t) => t.id) },
						storageKey: { not: null },
					},
					select: {
						id: true,
						filename: true,
						mimeType: true,
						extractedText: true,
						extractedBy: true,
						extractError: true,
					},
				});

				const PARSEABLE_RE =
					/\.(pdf|docx?|xlsx?|csv|txt|json|md)$/i;
				const parseable = attachments.filter((a) => {
					const m = a.mimeType ?? "";
					return (
						PARSEABLE_RE.test(a.filename) ||
						m === "application/pdf" ||
						m.startsWith("text/") ||
						m === "application/json" ||
						m.includes("wordprocessingml") ||
						m.includes("msword") ||
						m.includes("spreadsheetml") ||
						m.includes("ms-excel")
					);
				});

				const cached: typeof parseable = [];
				const needsOcr: typeof parseable = [];
				const failed: typeof parseable = [];
				for (const a of parseable) {
					if (a.extractedText && a.extractedText.length > 0) {
						cached.push(a);
					} else if (a.extractError) {
						failed.push(a);
					} else {
						needsOcr.push(a);
					}
				}

				const totalAtts = attachments.length;
				const totalParseable = parseable.length;
				const summary =
					needsOcr.length > 0
						? `${totalAtts} 个附件中有 ${needsOcr.length} 个还没解析过（多半是图片型 PDF 需要 OCR）。这些会让 analyze_each_email 拿不到附件内容——建议先告诉用户「有 N 个 PDF 需要 OCR 才能识别内容（约 N×30 秒）」并询问是否要 OCR，用户同意后调 ocr_pending_attachments(entityId)。`
						: failed.length > 0
							? `${totalAtts} 个附件中 ${cached.length} 已缓存、${failed.length} 之前解析失败。可以直接 analyze_each_email；如要重试失败附件用 read_attachments_batch(forceRefresh=true)。`
							: `${totalAtts} 个附件全部已缓存（${cached.length}/${totalParseable}），可以直接 analyze_each_email。`;

				return {
					entityId: input.entityId,
					totalAttachments: totalAtts,
					parseable: totalParseable,
					cached: cached.length,
					needsOcr: needsOcr.length,
					failed: failed.length,
					needsOcrItems: needsOcr.slice(0, 20).map((a) => ({
						id: a.id,
						filename: a.filename,
					})),
					summary,
				};
			},
		}),

		ocr_pending_attachments: tool({
			description:
				"【显式触发的 OCR 工具】对一个事项下还没解析的附件批量跑 OCR/pdf-parse，结果落库供后续 analyze_each_email 秒读。用户能看到本次 OCR 几个文件成功几个失败。【分批协议】单次最多处理 maxBatch 个（默认 5，OCR 单文件最多 30s + 90s 超时保护，单次工具调用预算 ~3 分钟）；返回 remaining，如果 remaining>0 必须用同样参数继续调用直到 remaining=0。每批之间给用户一句进度（「已 OCR 5/12，剩 7 个继续」）。如果 OCR 完发现某些 PDF 仍是空的（图片型识别失败），如实告诉用户。",
			inputSchema: z.object({
				entityId: z.string().describe("事项 ID"),
				maxBatch: z
					.number()
					.int()
					.min(1)
					.max(8)
					.optional()
					.default(5)
					.describe("单次最多 OCR 几个，默认 5（建议不超过 5 避免超时）"),
			}),
			execute: async (input: { entityId: string; maxBatch: number }) => {
				if (!isStorageEnabled()) {
					return {
						status: "storage_not_configured",
						message: "存储未配置",
					};
				}
				if (!deps?.ocrPdfBuffer) {
					return {
						status: "ocr_not_configured",
						message: "OCR 服务未注入（ZHIPU_API_KEY 未配置）",
					};
				}
				const maxBatch = input.maxBatch ?? 5;

				const threads = await db.emailThread.findMany({
					where: { entityId: input.entityId },
					select: { id: true },
				});
				if (threads.length === 0) {
					return {
						processed: 0,
						remaining: 0,
						message: "事项下没有邮件",
					};
				}

				const allAtts = await db.emailAttachment.findMany({
					where: {
						threadId: { in: threads.map((t) => t.id) },
						storageKey: { not: null },
						extractedText: null,
						extractError: null,
					},
					orderBy: { createdAt: "asc" },
				});

				const PARSEABLE_RE = /\.(pdf|docx?|xlsx?|csv|txt|json|md)$/i;
				const todo = allAtts
					.filter((a) => {
						const m = a.mimeType ?? "";
						return (
							PARSEABLE_RE.test(a.filename) ||
							m === "application/pdf" ||
							m.includes("wordprocessingml") ||
							m.includes("msword") ||
							m.includes("spreadsheetml") ||
							m.includes("ms-excel") ||
							m.startsWith("text/") ||
							m === "application/json"
						);
					})
					.slice(0, maxBatch);

				if (todo.length === 0) {
					return {
						processed: 0,
						remaining: 0,
						message: "没有待 OCR 的附件，可直接 analyze_each_email。",
					};
				}

				const PER_FILE_TIMEOUT = 90_000;
				let okCount = 0;
				let failCount = 0;
				const details: Array<{
					filename: string;
					status: "ok" | "fail" | "empty";
					extractor?: string;
					chars?: number;
					error?: string;
				}> = [];

				async function ocrOne(att: (typeof todo)[number]) {
					const filename = att.filename;
					const mime = att.mimeType ?? "";
					const lower = filename.toLowerCase();
					const isPdf =
						mime === "application/pdf" || lower.endsWith(".pdf");
					try {
						const url = await getSignedUrl(att.storageKey as string, {
							bucket: "attachments",
							expiresIn: 600,
						});
						const r = await fetch(url);
						if (!r.ok) {
							throw new Error(`download HTTP ${r.status}`);
						}
						const buf = Buffer.from(await r.arrayBuffer());

						let content = "";
						let extractor = "";

						if (isPdf) {
							let pdfText = "";
							try {
								const parsed = await pdfParse(buf);
								pdfText = parsed.text ?? "";
							} catch {
								// fallthrough to OCR
							}
							if (pdfText.trim().length >= 50) {
								content = pdfText;
								extractor = "pdf";
							} else if (deps?.ocrPdfBuffer) {
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
									content = "";
									extractor = "pdf+ocr_empty";
								}
							}
						} else if (
							mime.includes("wordprocessingml") ||
							mime.includes("msword") ||
							lower.endsWith(".docx") ||
							lower.endsWith(".doc")
						) {
							const result = await mammoth.extractRawText({ buffer: buf });
							content = result.value || "";
							extractor = "word";
						} else if (
							mime.includes("spreadsheetml") ||
							mime.includes("ms-excel") ||
							lower.endsWith(".xlsx") ||
							lower.endsWith(".xls") ||
							lower.endsWith(".csv")
						) {
							const wb = XLSX.read(buf, { type: "buffer" });
							const parts: string[] = [];
							for (const name of wb.SheetNames) {
								const sheet = wb.Sheets[name];
								if (sheet) {
									parts.push(
										`## Sheet: ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`,
									);
								}
							}
							content = parts.join("\n\n");
							extractor = "excel";
						} else if (
							mime.startsWith("text/") ||
							mime === "application/json"
						) {
							content = buf.toString("utf-8");
							extractor = "text";
						}

						if (content && content.trim().length > 0) {
							await db.emailAttachment.update({
								where: { id: att.id },
								data: {
									extractedText: content,
									extractedBy: extractor || "unknown",
									extractedAt: new Date(),
									extractError: null,
								},
							});
							okCount += 1;
							details.push({
								filename,
								status: "ok",
								extractor,
								chars: content.length,
							});
						} else {
							await db.emailAttachment.update({
								where: { id: att.id },
								data: {
									extractError: "ocr_empty",
									extractedAt: new Date(),
								},
							});
							failCount += 1;
							details.push({
								filename,
								status: "empty",
								error: "OCR 未识别出文字",
							});
						}
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						try {
							await db.emailAttachment.update({
								where: { id: att.id },
								data: {
									extractError: msg.slice(0, 500),
									extractedAt: new Date(),
								},
							});
						} catch {
							// ignore
						}
						failCount += 1;
						details.push({ filename, status: "fail", error: msg });
					}
				}

				// concurrency=2，单文件 90s 超时
				let cursor = 0;
				async function worker() {
					while (true) {
						const idx = cursor++;
						if (idx >= todo.length) {
							return;
						}
						const att = todo[idx];
						await Promise.race<void>([
							ocrOne(att),
							new Promise<void>((resolve) =>
								setTimeout(() => {
									failCount += 1;
									details.push({
										filename: att.filename,
										status: "fail",
										error: "timeout >90s",
									});
									resolve();
								}, PER_FILE_TIMEOUT),
							),
						]);
					}
				}
				await Promise.all(
					Array.from({ length: Math.min(2, todo.length) }, worker),
				);

				// 重新数还剩多少
				const remainingCount = await db.emailAttachment.count({
					where: {
						threadId: { in: threads.map((t) => t.id) },
						storageKey: { not: null },
						extractedText: null,
						extractError: null,
					},
				});

				const message =
					remainingCount > 0
						? `本批 OCR 完成：${okCount} 成功 / ${failCount} 失败。还剩 ${remainingCount} 个待 OCR——请用相同参数继续调本工具，跑完再 analyze_each_email。`
						: `OCR 全部完成：本批 ${okCount} 成功 / ${failCount} 失败。${failCount > 0 ? "失败的多半是扫描质量太差的图片 PDF，识别不出来，正常分析时这部分附件就拿不到文字。" : ""} 现在可以 analyze_each_email。`;

				return {
					processed: todo.length,
					ok: okCount,
					failed: failCount,
					remaining: remainingCount,
					details,
					message,
				};
			},
		}),
	};
}
