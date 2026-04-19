import { pdfToPng } from "pdf-to-png-converter";

export interface PdfPageImage {
	pageNumber: number;
	buffer: Buffer;
	width: number;
	height: number;
}

export interface PdfToImagesOptions {
	/** 最多渲染前 N 页（避免长 PDF 触发限流），默认 20 */
	maxPages?: number;
	/** 渲染缩放，影响 OCR 准确率与文件体积，默认 2 */
	viewportScale?: number;
}

/**
 * 把 PDF buffer 转成每一页的 PNG buffer。
 * 用于扫描件/图片型 PDF 的 OCR 流程。
 */
export async function pdfBufferToPngImages(
	pdfBuffer: Buffer,
	options?: PdfToImagesOptions,
): Promise<PdfPageImage[]> {
	const maxPages = options?.maxPages ?? 20;
	const viewportScale = options?.viewportScale ?? 2;

	const pages = await pdfToPng(pdfBuffer, {
		viewportScale,
		disableFontFace: true,
		useSystemFonts: false,
		processPagesInParallel: false,
		returnPageContent: true,
	});

	return pages.slice(0, maxPages).map((p) => ({
		pageNumber: p.pageNumber,
		buffer: p.content as Buffer,
		width: p.width,
		height: p.height,
	}));
}
