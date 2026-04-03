import type { AiAdapter, AnalyzeRequest, AnalyzeResponse } from "./types";

interface VercelAiAdapterConfig {
	apiUrl?: string;
	headers?: Record<string, string>;
}

export function createVercelAiAdapter(
	config?: VercelAiAdapterConfig,
): AiAdapter {
	const apiUrl = config?.apiUrl ?? "/api/ai-eyes/analyze";

	return {
		async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
			const res = await fetch(apiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...config?.headers,
				},
				body: JSON.stringify({
					confusionEvent: request.confusionEvent,
					appContext: request.appContext,
					locale: request.locale,
				}),
			});

			if (!res.ok) {
				throw new Error(`AI analysis failed: ${res.status}`);
			}

			return (await res.json()) as AnalyzeResponse;
		},
	};
}
