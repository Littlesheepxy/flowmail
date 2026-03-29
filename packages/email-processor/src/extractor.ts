import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { ApprovalExtractionSchema } from "./schemas/approval";
import type { ApprovalExtraction } from "./schemas/approval";
import { ReportExtractionSchema } from "./schemas/report";
import type { ReportExtraction } from "./schemas/report";

export async function extractApprovalFields(
	emailContent: string,
): Promise<ApprovalExtraction> {
	const { object } = await generateObject({
		model: openai("gpt-4o"),
		schema: ApprovalExtractionSchema,
		prompt: `Extract approval-related information from this email. If a field is not present, use reasonable defaults.

Email content:
${emailContent}`,
	});

	return object;
}

export async function extractReportFields(
	emailContent: string,
): Promise<ReportExtraction> {
	const { object } = await generateObject({
		model: openai("gpt-4o"),
		schema: ReportExtractionSchema,
		prompt: `Extract report/progress update information from this email. Parse completed items, in-progress items, blockers, and next steps.

Email content:
${emailContent}`,
	});

	return object;
}
