import { generateText, Output, textModel } from "@repo/ai";
import type { ApprovalExtraction } from "./schemas/approval";
import { ApprovalExtractionSchema } from "./schemas/approval";
import type { ReportExtraction } from "./schemas/report";
import { ReportExtractionSchema } from "./schemas/report";

export async function extractApprovalFields(
	emailContent: string,
): Promise<ApprovalExtraction> {
	const { output: object } = await generateText({
		model: textModel,
		output: Output.object({ schema: ApprovalExtractionSchema }),
		prompt: `Extract approval-related information from this email. If a field is not present, use reasonable defaults.

Email content:
${emailContent}`,
	});

	return object;
}

export async function extractReportFields(
	emailContent: string,
): Promise<ReportExtraction> {
	const { output: object } = await generateText({
		model: textModel,
		output: Output.object({ schema: ReportExtractionSchema }),
		prompt: `Extract report/progress update information from this email. Parse completed items, in-progress items, blockers, and next steps.

Email content:
${emailContent}`,
	});

	return object;
}
