import {
	ANALYZE_CONFUSION_SYSTEM_PROMPT,
	buildAnalyzeUserMessage,
} from "../prompts/analyze-confusion";
import type { AiAdapter, AnalyzeRequest, AnalyzeResponse } from "./types";

interface OpenAiRestConfig {
	apiKey: string;
	model?: string;
	baseUrl?: string;
}

export function createOpenAiRestAdapter(config: OpenAiRestConfig): AiAdapter {
	const model = config.model ?? "gpt-4o-mini";
	const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";

	return {
		async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
			const res = await fetch(`${baseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.apiKey}`,
				},
				body: JSON.stringify({
					model,
					messages: [
						{
							role: "system",
							content: ANALYZE_CONFUSION_SYSTEM_PROMPT,
						},
						{
							role: "user",
							content: buildAnalyzeUserMessage(
								request.confusionEvent,
								request.appContext,
							),
						},
					],
					max_tokens: 200,
					temperature: 0.3,
					response_format: { type: "json_object" },
				}),
			});

			if (!res.ok) {
				throw new Error(`OpenAI API error: ${res.status}`);
			}

			const data = (await res.json()) as {
				choices: Array<{ message: { content: string } }>;
			};
			const content = data.choices[0]?.message?.content;
			if (!content) {
				return {
					shouldHelp: false,
					message: "",
					confidence: 0,
				};
			}

			return JSON.parse(content) as AnalyzeResponse;
		},
	};
}
