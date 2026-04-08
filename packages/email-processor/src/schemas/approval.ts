import { z } from "zod";

export const ApprovalExtractionSchema = z.object({
	title: z.string().describe("Approval item title, concise"),
	requester: z
		.object({
			name: z.string(),
			email: z.string().email(),
		})
		.describe("Requester info"),
	requestContent: z.string().describe("Request content summary, max 100 chars"),
	amount: z.number().optional().describe("Amount if applicable"),
	currency: z.string().optional().describe("Currency code, e.g. CNY/USD"),
	deadline: z.string().optional().describe("Approval deadline, ISO 8601"),
	urgency: z.enum(["low", "normal", "high", "urgent"]).describe("Urgency level"),
	nextActions: z.array(z.string()).describe("Recommended next steps, e.g. review, approve, request more info"),
	blockers: z.array(z.string()).describe("Anything blocking the approval, e.g. missing documents"),
	inProgressItems: z.array(z.string()).describe("Items currently being worked on related to this approval"),
});

export type ApprovalExtraction = z.infer<typeof ApprovalExtractionSchema>;
