import { textModel, safeGenerateObject } from "@repo/ai";
import { ApprovalExtractionSchema } from "./schemas/approval";
import type { ApprovalExtraction } from "./schemas/approval";
import { ReportExtractionSchema } from "./schemas/report";
import type { ReportExtraction } from "./schemas/report";

export async function extractApprovalFields(
	emailContent: string,
): Promise<ApprovalExtraction> {
	return safeGenerateObject({
		model: textModel,
		schema: ApprovalExtractionSchema,
		prompt: `Extract approval-related information from this email. If a field is not present, use reasonable defaults.

For nextActions: identify what needs to happen next (e.g. "review budget details", "approve request", "request additional documentation").
For blockers: identify anything preventing approval (e.g. "missing ROI data", "budget exceeds authority limit").
For inProgressItems: identify things currently being worked on (e.g. "applicant preparing supplementary materials").
Return empty arrays if none apply.

Email content:
${emailContent}`,
	});
}

export async function extractReportFields(
	emailContent: string,
): Promise<ReportExtraction> {
	return safeGenerateObject({
		model: textModel,
		schema: ReportExtractionSchema,
		prompt: `Extract report/progress update information from this email. Parse completed items, in-progress items, blockers, and next steps.

Email content:
${emailContent}`,
	});
}
