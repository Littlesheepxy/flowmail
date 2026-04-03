import type { ConfusionEvent, HelpSuggestion } from "@ai-eyes/core";

export interface AnalyzeRequest {
	confusionEvent: ConfusionEvent;
	appContext?: Record<string, unknown>;
	locale?: string;
}

export type AnalyzeResponse = HelpSuggestion;

export interface AiAdapter {
	analyze(request: AnalyzeRequest): Promise<AnalyzeResponse>;
}

export interface HelpRule {
	signal?: string;
	page?: string | RegExp;
	appState?: Record<string, unknown>;
	message: string;
	suggestedAction?: string;
	suggestedMessage?: string;
	confidence?: number;
}
