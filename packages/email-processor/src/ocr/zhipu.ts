/**
 * 智谱 AI OCR 服务封装
 * https://docs.bigmodel.cn/cn/guide/tools/zhipu-ocr
 *
 * 接口: POST https://open.bigmodel.cn/api/paas/v4/files/ocr
 * 接受图片文件（JPG/PNG），返回识别出的文本块。
 */

const DEFAULT_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/files/ocr";

export interface ZhipuOcrWord {
	words: string;
	location?: { left: number; top: number; width: number; height: number };
	probability?: { average: number; variance: number; min: number };
}

export interface ZhipuOcrResult {
	taskId: string;
	status: "succeeded" | "failed";
	wordsResultNum: number;
	words: ZhipuOcrWord[];
	/** 拼接后的纯文本 */
	text: string;
}

export interface ZhipuOcrOptions {
	/** 待识别的图片 buffer（PNG/JPG） */
	image: Buffer;
	/** 文件名（含扩展名，影响 mime） */
	filename: string;
	/** OCR 工具类型；目前 API 仅支持 hand_write，但实际同样适用于印刷体识别 */
	toolType?: "hand_write";
	/** 语言；中英混合默认 CHN_ENG */
	languageType?: "CHN_ENG" | "AUTO" | "ENG" | "JAP" | "KOR";
	/** 是否返回置信度 */
	probability?: boolean;
	/** 自定义 API key，未传则读取 ZHIPU_API_KEY */
	apiKey?: string;
	/** 自定义 endpoint */
	endpoint?: string;
	/** 超时（毫秒），默认 60s */
	timeoutMs?: number;
}

function guessMime(filename: string): string {
	const lower = filename.toLowerCase();
	if (lower.endsWith(".png")) {
		return "image/png";
	}
	if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
		return "image/jpeg";
	}
	if (lower.endsWith(".webp")) {
		return "image/webp";
	}
	if (lower.endsWith(".gif")) {
		return "image/gif";
	}
	if (lower.endsWith(".bmp")) {
		return "image/bmp";
	}
	return "application/octet-stream";
}

export function isZhipuOcrConfigured(): boolean {
	return !!process.env.ZHIPU_API_KEY;
}

/**
 * 调用智谱 OCR 识别单张图片。
 * 失败时抛错；调用方负责捕获并降级。
 */
export async function recognizeImageWithZhipu(
	options: ZhipuOcrOptions,
): Promise<ZhipuOcrResult> {
	const apiKey = options.apiKey ?? process.env.ZHIPU_API_KEY;
	if (!apiKey) {
		throw new Error("ZHIPU_API_KEY is not configured");
	}

	const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
	const toolType = options.toolType ?? "hand_write";
	const languageType = options.languageType ?? "CHN_ENG";

	const form = new FormData();
	const blob = new Blob([options.image as unknown as ArrayBuffer], {
		type: guessMime(options.filename),
	});
	form.append("file", blob, options.filename);
	form.append("tool_type", toolType);
	form.append("language_type", languageType);
	if (options.probability) {
		form.append("probability", "true");
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

	let res: Response;
	try {
		res = await fetch(endpoint, {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}` },
			body: form,
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timer);
	}

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`Zhipu OCR HTTP ${res.status}: ${text.slice(0, 300)}`);
	}

	const json = (await res.json()) as {
		task_id?: string;
		status?: "succeeded" | "failed";
		message?: string;
		words_result_num?: number;
		words_result?: ZhipuOcrWord[];
		error?: { code: string; message: string };
	};

	if (json.error) {
		throw new Error(
			`Zhipu OCR error ${json.error.code}: ${json.error.message}`,
		);
	}

	if (json.status !== "succeeded") {
		throw new Error(`Zhipu OCR failed: ${json.message ?? "unknown"}`);
	}

	const words = json.words_result ?? [];
	const text = words
		.map((w) => w.words?.trim())
		.filter(Boolean)
		.join("\n");

	return {
		taskId: json.task_id ?? "",
		status: json.status,
		wordsResultNum: json.words_result_num ?? words.length,
		words,
		text,
	};
}

/**
 * 批量识别多张图片，按页拼接为一段文本。
 * 任一页失败不会中断后续页（仅记录错误）。
 */
export async function recognizeImagesWithZhipu(
	images: { buffer: Buffer; filename: string }[],
	options?: Omit<ZhipuOcrOptions, "image" | "filename">,
): Promise<{
	text: string;
	pageCount: number;
	successCount: number;
	errors: { page: number; message: string }[];
}> {
	const errors: { page: number; message: string }[] = [];
	const parts: string[] = [];
	let successCount = 0;

	for (let i = 0; i < images.length; i++) {
		const img = images[i];
		if (!img) {
			continue;
		}
		try {
			const result = await recognizeImageWithZhipu({
				...options,
				image: img.buffer,
				filename: img.filename,
			});
			if (result.text) {
				parts.push(`[第 ${i + 1} 页]\n${result.text}`);
				successCount++;
			}
		} catch (err) {
			errors.push({
				page: i + 1,
				message: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return {
		text: parts.join("\n\n"),
		pageCount: images.length,
		successCount,
		errors,
	};
}
