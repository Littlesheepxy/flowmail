import { z } from "zod";

export const ApprovalExtractionSchema = z.object({
	title: z.string().describe("Approval item title, concise"),
	requester: z
		.object({
			name: z.string(),
			email: z.string().email(),
		})
		.describe("Requester info"),
	requestContent: z
		.string()
		.describe("Request content summary, max 100 chars"),
	amount: z.number().optional().describe("Amount if applicable"),
	currency: z.string().optional().describe("Currency code, e.g. CNY/USD"),
	deadline: z.string().optional().describe("Approval deadline, ISO 8601"),
	urgency: z
		.enum(["low", "normal", "high", "urgent"])
		.describe("Urgency level"),
});

export type ApprovalExtraction = z.infer<typeof ApprovalExtractionSchema>;
