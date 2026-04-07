import {
	ANALYZE_CONFUSION_SYSTEM_PROMPT,
	buildAnalyzeUserMessage,
} from "../prompts/analyze-confusion";

interface HandlerConfig {
	generateText: (params: {
		model: unknown;
		system: string;
		prompt: string;
		maxTokens: number;
		temperature: number;
	}) => Promise<{ text: string }>;
	model: unknown;
	systemPrompt?: string;
	maxTokens?: number;
}

/**
 * Creates a Next.js Route Handler for AI behavior analysis.
 *
 * Usage:
 * ```ts
 * import { createAnalyzeHandler } from "@ai-eyes/ai/server";
 * import { generateText } from "ai";
 * import { openai } from "@ai-sdk/openai";
 *
 * export const POST = createAnalyzeHandler({
 *   generateText,
 *   model: openai("gpt-4o-mini"),
 * });
 * ```
 */
export function createAnalyzeHandler(config: HandlerConfig) {
	return async (request: Request): Promise<Response> => {
		try {
			const body = (await request.json()) as {
				confusionEvent: unknown;
				appContext?: Record<string, unknown>;
				locale?: string;
			};

			const confusionEvent = body.confusionEvent as {
				score: number;
				signals: Array<{
					type: string;
					element?: { tagName: string; textContent: string };
					duration?: number;
					count?: number;
				}>;
				context: {
					route: string;
					pageTitle?: string;
					emptyStates?: string[];
					appState?: Record<string, unknown>;
				};
				recentActions: Array<{ type: string; target?: string }>;
			};

			const userMessage = buildAnalyzeUserMessage(
				confusionEvent,
				body.appContext,
			);

			const systemPrompt =
				config.systemPrompt ?? ANALYZE_CONFUSION_SYSTEM_PROMPT;

			const result = await config.generateText({
				model: config.model,
				system: `${systemPrompt}\n\nRespond ONLY with valid JSON.`,
				prompt: userMessage,
				maxTokens: config.maxTokens ?? 200,
				temperature: 0.3,
			});

			const parsed = JSON.parse(result.text);

			return Response.json({
				shouldHelp: Boolean(parsed.shouldHelp),
				message: String(parsed.message ?? ""),
				suggestedAction: parsed.suggestedAction
					? String(parsed.suggestedAction)
					: undefined,
				suggestedMessage: parsed.suggestedMessage
					? String(parsed.suggestedMessage)
					: undefined,
				confidence: Number(parsed.confidence ?? 0),
			});
		} catch (err) {
			console.error("[ai-eyes] Analyze handler error:", err);
			return Response.json(
				{ shouldHelp: false, message: "", confidence: 0 },
				{ status: 200 },
			);
		}
	};
}
