import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import {
	ClassificationResultSchema,
	DynamicClassificationResultSchema,
} from "./schemas/classification";
import type {
	ClassificationResult,
	DynamicClassificationResult,
} from "./schemas/classification";

export interface CategoryDefinition {
	id: string;
	name: string;
	slug: string;
	aiPrompt: string;
}

/**
 * Legacy classifier with hardcoded types — kept for backward compatibility.
 */
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

/**
 * Dynamic classifier that uses user-defined categories and their AI prompts.
 */
export async function classifyEmailDynamic(
	input: {
		subject: string;
		sender: string;
		content: string;
	},
	categories: CategoryDefinition[],
): Promise<DynamicClassificationResult> {
	if (categories.length === 0) {
		return {
			categorySlug: "unknown",
			confidence: 0,
			reasoning: "No categories defined for this organization",
		};
	}

	const categoryDescriptions = categories
		.map((cat) => `- ${cat.slug} (${cat.name}): ${cat.aiPrompt}`)
		.join("\n");

	const validSlugs = categories.map((c) => c.slug).join(", ");

	const { object } = await generateObject({
		model: openai("gpt-4o-mini"),
		schema: DynamicClassificationResultSchema,
		prompt: `You are an enterprise email classifier. Analyze the following email and classify it into ONE of the provided categories.

Email Subject: ${input.subject}
Sender: ${input.sender}
Email Content (first 500 chars): ${input.content.slice(0, 500)}

Available categories:
${categoryDescriptions}

Return the categorySlug of the best matching category (one of: ${validSlugs}, or "unknown" if no category fits).
Include confidence (0-1) and brief reasoning.`,
	});

	return object;
}
