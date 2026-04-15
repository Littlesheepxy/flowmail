import { z } from "zod";

export const ReportExtractionSchema = z.object({
	title: z.string().describe("Report title"),
	reporter: z
		.object({
			name: z.string(),
			email: z.string().describe("Reporter email, or empty string if unknown"),
		})
		.describe("Reporter info"),
	period: z
		.object({
			type: z.enum(["daily", "weekly", "monthly", "ad_hoc"]),
			startDate: z.string().nullable().optional().describe("Start date ISO 8601, or null"),
			endDate: z.string().nullable().optional().describe("End date ISO 8601, or null"),
		})
		.describe("Reporting period"),
	keyPoints: z.array(z.string()).max(5).describe("Key points, max 5"),
	completedItems: z.array(z.string()).describe("Completed items"),
	inProgressItems: z.array(z.string()).describe("In-progress items"),
	blockers: z.array(z.string()).describe("Blockers or risks"),
	nextActions: z.array(z.string()).describe("Next steps"),
	overallStatus: z.enum(["on_track", "at_risk", "blocked"]).describe("Overall status"),
});

export type ReportExtraction = z.infer<typeof ReportExtractionSchema>;
