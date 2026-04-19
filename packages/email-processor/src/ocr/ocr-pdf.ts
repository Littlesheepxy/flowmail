import { pdfBufferToPngImages, type PdfToImagesOptions } from "./pdf-to-images";
import { recognizeImagesWithZhipu, isZhipuOcrConfigured } from "./zhipu";

export interface OcrPdfResult {
	text: string;
	pageCount: number;
	successCount: number;
	errors: { page: number; message: string }[];
	skipped?: "no_api_key" | "no_pages";
}

/**
 * 把图片型 PDF 通过「PDF→PNG→智谱 OCR」管线提取文本。
 * 调用前请确保 ZHIPU_API_KEY 已配置；未配置时返回 skipped。
 */
export async function ocrPdfBuffer(
	pdfBuffer: Buffer,
	options?: PdfToImagesOptions,
): Promise<OcrPdfResult> {
	if (!isZhipuOcrConfigured()) {
		return {
			text: "",
			pageCount: 0,
			successCount: 0,
			errors: [],
			skipped: "no_api_key",
		};
	}

	const images = await pdfBufferToPngImages(pdfBuffer, options);
	if (images.length === 0) {
		return {
			text: "",
			pageCount: 0,
			successCount: 0,
			errors: [],
			skipped: "no_pages",
		};
	}

	const result = await recognizeImagesWithZhipu(
		images.map((img) => ({
			buffer: img.buffer,
			filename: `page-${img.pageNumber}.png`,
		})),
	);

	return {
		text: result.text,
		pageCount: result.pageCount,
		successCount: result.successCount,
		errors: result.errors,
	};
}
