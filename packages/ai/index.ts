import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

// ─── Provider 选择逻辑 ───
//
// 优先级：
// 1. ANTHROPIC_AUTH_TOKEN 或 ANTHROPIC_API_KEY → Anthropic 原生 SDK（/v1/messages）
// 2. AI_GATEWAY_BASE_URL + AI_GATEWAY_API_KEY → OpenAI 兼容格式（OneAPI / OpenRouter 等）
// 3. OPENAI_API_KEY → 官方 OpenAI API

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
			// createAnthropic 的 baseURL 不需要 /v1 后缀，SDK 会自动拼接
			baseURL: (anthropicBase ?? "https://api.anthropic.com").replace(/\/v1\/?$/, ""),
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

// 缓存当前配置的 key，env 变化时重新初始化
let _cachedConfigKey = "";
let _anthropicProvider: ReturnType<typeof createAnthropic> | null = null;
let _openaiProvider: ReturnType<typeof createOpenAI> | null = null;

function getProvider() {
	const config = detectProvider();
	const configKey = `${config.type}:${config.baseURL}:${config.apiKey.slice(-8)}`;

	// env 变化时清除缓存
	if (configKey !== _cachedConfigKey) {
		_anthropicProvider = null;
		_openaiProvider = null;
		_cachedConfigKey = configKey;
	}

	if (config.type === "anthropic") {
		if (!_anthropicProvider) {
			_anthropicProvider = createAnthropic({
				baseURL: config.baseURL,
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

// 每次调用都重新创建（不缓存 model 实例，避免 provider 切换后用旧实例）
export function getFastModel() {
	return createModel("AI_FAST_MODEL", "claude-haiku-4-5-20251001", "gpt-4o-mini");
}

export function getTextModel() {
	return createModel("AI_TEXT_MODEL", "claude-sonnet-4-6", "gpt-4o");
}

export function getReasoningModel() {
	return createModel("AI_REASONING_MODEL", "claude-opus-4-6", "o3-mini");
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
