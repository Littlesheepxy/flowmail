import { generateText, fastModel, Output } from "@repo/ai";
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

export interface MemoryRecaller {
	recallBySender(
		organizationId: string,
		sender: string,
		limit?: number,
	): Promise<Array<{
		id: string;
		category: string;
		content: string;
		metadata?: Record<string, unknown>;
		createdAt: Date;
	}>>;
	recordClassification(params: {
		organizationId: string;
		emailSubject: string;
		sender: string;
		classification: string;
		confidence: number;
	}): Promise<void>;
}

/**
 * Legacy classifier with hardcoded types — kept for backward compatibility.
 */
export async function classifyEmail(input: {
	subject: string;
	sender: string;
	content: string;
}): Promise<ClassificationResult> {
	const { output: object } = await generateText({
		model: fastModel,
		output: Output.object({ schema: ClassificationResultSchema }),
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

	const { output: object } = await generateText({
		model: fastModel,
		output: Output.object({ schema: DynamicClassificationResultSchema }),
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

/**
 * Memory-enhanced classifier: injects historical classification context
 * from the same sender to improve accuracy over time.
 */
export async function classifyEmailWithMemory(
	input: { subject: string; sender: string; content: string },
	organizationId: string,
	memory: MemoryRecaller,
): Promise<ClassificationResult> {
	const history = await memory.recallBySender(organizationId, input.sender, 5);

	let historyBlock = "";
	if (history.length > 0) {
		const lines = history.map((h) => {
			const meta = h.metadata as
				| { subject?: string; classification?: string; confidence?: number; userCorrected?: boolean; correctedTo?: string }
				| undefined;
			if (meta?.userCorrected) {
				return `- "${meta.subject}" was corrected from ${meta.classification} to ${meta.correctedTo}`;
			}
			return `- "${meta?.subject}" classified as ${meta?.classification} (confidence: ${Math.round((meta?.confidence ?? 0) * 100)}%)`;
		});
		historyBlock = `\n\nHistorical classifications from this sender:\n${lines.join("\n")}\nUse this history to inform your classification, especially if the user corrected previous classifications.`;
	}

	const { output: object } = await generateText({
		model: fastModel,
		output: Output.object({ schema: ClassificationResultSchema }),
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

Return your classification with confidence (0-1) and brief reasoning.${historyBlock}`,
	});

	memory
		.recordClassification({
			organizationId,
			emailSubject: input.subject,
			sender: input.sender,
			classification: object.type,
			confidence: object.confidence,
		})
		.catch(() => {});

	return object;
}
