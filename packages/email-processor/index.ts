export { processEmail, processEmailRaw } from "./src/processor";
export {
	processInboundEmail,
	computeContentHash,
} from "./src/inbound";
export { classifyEmail, classifyEmailWithMemory, classifyEmailDynamic } from "./src/classifier";
export type { CategoryDefinition } from "./src/classifier";
export { extractApprovalFields, extractReportFields } from "./src/extractor";
export { summarizeThread } from "./src/summarizer";
export { generateSuggestions } from "./src/suggester";
export type { AISuggestion } from "./src/suggester";
export { generateTags } from "./src/tagger";
export { enrichEntityById, classifyEntityOnly } from "./src/enricher";
export {
	analyzeIndividualEmail,
	analyzeAllPendingEmails,
	regenerateEntityNarrative,
	triggerEmailAiNoteIfNeeded,
	EmailAiNoteSchema,
	type EmailAiNote,
} from "./src/email-ai-note";
export { findEntityByAiMatch } from "./src/ai-entity-matcher";
export type { AiEntityMatchInput, AiEntityMatchResult } from "./src/ai-entity-matcher";
export { detectMultipleProjects, MultiProjectDetectionSchema } from "./src/multi-project-detector";
export type { MultiProjectDetection, SubProjectCandidate } from "./src/multi-project-detector";
export {
	ensureDefaultCategories,
	getOrgCategories,
	SAMPLE_CATEGORIES,
} from "./src/seed-categories";
export { unwrapForwardedEmail } from "./src/unwrap-forward";
export type { UnwrapResult } from "./src/unwrap-forward";
export { getConnector } from "./src/connectors";
export {
	isZhipuOcrConfigured,
	recognizeImageWithZhipu,
	recognizeImagesWithZhipu,
	pdfBufferToPngImages,
	ocrPdfBuffer,
	type ZhipuOcrOptions,
	type ZhipuOcrResult,
	type ZhipuOcrWord,
	type PdfPageImage,
	type PdfToImagesOptions,
	type OcrPdfResult,
} from "./src/ocr";
export type { ClassificationResult } from "./src/schemas/classification";
export type { ApprovalExtraction } from "./src/schemas/approval";
export type { ReportExtraction } from "./src/schemas/report";
export type {
	ConnectionCredentials,
	EmailConnector,
	EmailRecipient,
	RawEmail,
	RawEmailAttachment,
	SyncResult,
} from "./src/connectors";
