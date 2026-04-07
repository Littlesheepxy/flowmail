import type { LanguageModelV1 } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

let _gateway: ReturnType<typeof createOpenAI> | null = null;

function getGateway() {
	if (!_gateway) {
		const baseURL = process.env.AI_GATEWAY_BASE_URL;
		const apiKey =
			process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY;

		if (!baseURL || !apiKey) {
			console.warn(
				"[AI] Missing AI_GATEWAY_BASE_URL or AI_GATEWAY_API_KEY. AI features will fail at runtime.",
			);
		}

		_gateway = createOpenAI({
			baseURL: baseURL ?? "https://api.openai.com/v1",
			apiKey: apiKey ?? "",
		});
	}
	return _gateway;
}

function getModelName(
	envKey: string,
	fallback: string,
): string {
	return process.env[envKey] || fallback;
}

export const fastModel: LanguageModelV1 = new Proxy({} as LanguageModelV1, {
	get(_, prop) {
		const model = getGateway().chat(getModelName("AI_FAST_MODEL", "gpt-4o-mini"));
		return Reflect.get(model, prop, model);
	},
});

export const textModel: LanguageModelV1 = new Proxy({} as LanguageModelV1, {
	get(_, prop) {
		const model = getGateway().chat(getModelName("AI_TEXT_MODEL", "gpt-4o"));
		return Reflect.get(model, prop, model);
	},
});

export const reasoningModel: LanguageModelV1 = new Proxy({} as LanguageModelV1, {
	get(_, prop) {
		const model = getGateway().chat(getModelName("AI_REASONING_MODEL", "o3-mini"));
		return Reflect.get(model, prop, model);
	},
});

export * from "ai";
export * from "./lib";
