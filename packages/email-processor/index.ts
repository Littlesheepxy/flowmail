export { classifyEmail, classifyEmailWithMemory } from "./src/classifier";
export type {
	ConnectionCredentials,
	EmailConnector,
	EmailRecipient,
	RawEmail,
	RawEmailAttachment,
	SyncResult,
} from "./src/connectors";
export { getConnector } from "./src/connectors";
export { extractApprovalFields, extractReportFields } from "./src/extractor";
export { processEmail, storeEmailOnly } from "./src/processor";
export type { ApprovalExtraction } from "./src/schemas/approval";
export type { ClassificationResult } from "./src/schemas/classification";
export type { ReportExtraction } from "./src/schemas/report";
export type { AISuggestion } from "./src/suggester";
export { generateSuggestions } from "./src/suggester";
export { summarizeThread } from "./src/summarizer";
