import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

// ─── Provider 选择逻辑 ───
//
// 优先级：
// 1. ANTHROPIC_AUTH_TOKEN + ANTHROPIC_BASE_URL → 使用 Anthropic SDK（原生 /v1/messages）
// 2. AI_GATEWAY_BASE_URL + AI_GATEWAY_API_KEY → 使用 OpenAI 兼容格式（OneAPI / OpenRouter 等）
// 3. ANTHROPIC_API_KEY → 官方 Anthropic API
// 4. OPENAI_API_KEY → 官方 OpenAI API

type ProviderType = "anthropic" | "openai-compat";

interface ProviderConfig {
	type: ProviderType;
	baseURL: string;
	apiKey: string;
}

function detectProvider(): ProviderConfig {
	const anthropicToken = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY;
	const anthropicBase = process.env.ANTHROPIC_BASE_URL;
	if (anthropicToken) {
		return {
			type: "anthropic",
			baseURL: anthropicBase ?? "https://api.anthropic.com",
			apiKey: anthropicToken,
		};
	}

	const gatewayBase = process.env.AI_GATEWAY_BASE_URL;
	const gatewayKey = process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY;
	if (!gatewayKey) {
		console.warn("[AI] No API key configured. Set ANTHROPIC_AUTH_TOKEN or AI_GATEWAY_API_KEY.");
	}
	return {
		type: "openai-compat",
		baseURL: gatewayBase ?? "https://api.openai.com/v1",
		apiKey: gatewayKey ?? "",
	};
}

let _anthropicProvider: ReturnType<typeof createAnthropic> | null = null;
let _openaiProvider: ReturnType<typeof createOpenAI> | null = null;

function getProvider() {
	const config = detectProvider();

	if (config.type === "anthropic") {
		if (!_anthropicProvider) {
			_anthropicProvider = createAnthropic({
				// createAnthropic 的 baseURL 不需要 /v1 后缀，SDK 会自动拼接
				baseURL: config.baseURL.replace(/\/v1\/?$/, ""),
				apiKey: config.apiKey,
			});
		}
		return { type: "anthropic" as const, provider: _anthropicProvider };
	}

	if (!_openaiProvider) {
		_openaiProvider = createOpenAI({
			baseURL: config.baseURL,
			apiKey: config.apiKey,
		});
	}
	return { type: "openai-compat" as const, provider: _openaiProvider };
}

function getModelName(envKey: string, fallback: string): string {
	return process.env[envKey] || fallback;
}

function createModel(envKey: string, defaultAnthropic: string, defaultOpenAI: string) {
	const { type, provider } = getProvider();
	const modelName = getModelName(envKey, type === "anthropic" ? defaultAnthropic : defaultOpenAI);
	if (type === "anthropic") {
		return (provider as ReturnType<typeof createAnthropic>)(modelName);
	}
	return (provider as ReturnType<typeof createOpenAI>).chat(modelName);
}

// 懒加载：首次访问时初始化，之后返回同一实例
let _fastModel: ReturnType<typeof createModel> | null = null;
let _textModel: ReturnType<typeof createModel> | null = null;
let _reasoningModel: ReturnType<typeof createModel> | null = null;

export function getFastModel() {
	if (!_fastModel) _fastModel = createModel("AI_FAST_MODEL", "claude-haiku-4-5-20251001", "gpt-4o-mini");
	return _fastModel;
}

export function getTextModel() {
	if (!_textModel) _textModel = createModel("AI_TEXT_MODEL", "claude-sonnet-4-6", "gpt-4o");
	return _textModel;
}

export function getReasoningModel() {
	if (!_reasoningModel) _reasoningModel = createModel("AI_REASONING_MODEL", "claude-opus-4-6", "o3-mini");
	return _reasoningModel;
}

// 向后兼容的导出（作为 getter，确保运行时初始化）
export const fastModel = new Proxy({} as ReturnType<typeof createModel>, {
	get(_, prop) { return Reflect.get(getFastModel(), prop, getFastModel()); },
});

export const textModel = new Proxy({} as ReturnType<typeof createModel>, {
	get(_, prop) { return Reflect.get(getTextModel(), prop, getTextModel()); },
});

export const reasoningModel = new Proxy({} as ReturnType<typeof createModel>, {
	get(_, prop) { return Reflect.get(getReasoningModel(), prop, getReasoningModel()); },
});

export * from "ai";
export * from "./lib";
