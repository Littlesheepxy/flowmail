import { z } from "zod";

export const ClassificationResultSchema = z.object({
	type: z.enum(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK", "UNKNOWN"]),
	confidence: z.number().min(0).max(1),
	reasoning: z.string().max(100),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

export const DynamicClassificationResultSchema = z.object({
	categorySlug: z.string(),
	confidence: z.number().min(0).max(1),
	reasoning: z.string().max(200),
});

export type DynamicClassificationResult = z.infer<
	typeof DynamicClassificationResultSchema
>;
