import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { ClassificationResultSchema } from "./schemas/classification";
import type { ClassificationResult } from "./schemas/classification";

export async function classifyEmail(input: {
	subject: string;
	sender: string;
	content: string;
}): Promise<ClassificationResult> {
	const { object } = await generateObject({
		model: openai("gpt-4o-mini"),
		schema: ClassificationResultSchema,
		prompt: `You are an enterprise email classifier. Analyze the following email and determine its business type.

Email Subject: ${input.subject}
Sender: ${input.sender}
Email Content (first 500 chars): ${input.content.slice(0, 500)}

Classify as:
- APPROVAL: contains approval requests, authorization needs ("please approve", "需要审批", etc.)
- REPORT: progress updates, weekly/daily reports, status updates
- ISSUE: problems, bugs, incidents, complaints
- FEEDBACK: suggestions, feedback, reviews
- UNKNOWN: cannot determine

Return your classification with confidence (0-1) and brief reasoning.`,
	});

	return object;
}
