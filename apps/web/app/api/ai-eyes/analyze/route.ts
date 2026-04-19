import { createAnalyzeHandler } from "@ai-eyes/ai/server";
import { generateText, fastModel } from "@repo/ai";

export const maxDuration = 25;

export const POST = createAnalyzeHandler({
	generateText: generateText as Parameters<typeof createAnalyzeHandler>[0]["generateText"],
	model: fastModel,
	maxTokens: 200,
});
