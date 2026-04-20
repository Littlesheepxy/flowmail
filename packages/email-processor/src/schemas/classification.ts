import { zConfidence } from "@repo/ai";
import { z } from "zod";

export const ClassificationResultSchema = z.object({
	type: z.enum(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK", "NOISE", "UNKNOWN"]),
	confidence: zConfidence(),
	reasoning: z.string().transform((s) => s.slice(0, 500)),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

export const DynamicClassificationResultSchema = z.object({
	categorySlug: z.string(),
	confidence: zConfidence(),
	reasoning: z.string().transform((s) => s.slice(0, 500)),
});

export type DynamicClassificationResult = z.infer<
	typeof DynamicClassificationResultSchema
>;
