export { processEmail } from "./src/processor";
export { classifyEmail } from "./src/classifier";
export { extractApprovalFields, extractReportFields } from "./src/extractor";
export { summarizeThread } from "./src/summarizer";
export type { ClassificationResult } from "./src/schemas/classification";
export type { ApprovalExtraction } from "./src/schemas/approval";
export type { ReportExtraction } from "./src/schemas/report";
