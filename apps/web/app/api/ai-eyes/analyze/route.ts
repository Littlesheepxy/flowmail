import { createAnalyzeHandler } from "@ai-eyes/ai/server";
import { fastModel, generateText } from "@repo/ai";

export const maxDuration = 15;

export const POST = createAnalyzeHandler({
	generateText: generateText as Parameters<
		typeof createAnalyzeHandler
	>[0]["generateText"],
	model: fastModel,
	maxTokens: 200,
});
