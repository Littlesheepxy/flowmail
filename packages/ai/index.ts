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
		// createAnthropic 的 baseURL 需要包含 /v1，因为 SDK 会在后面追加 /messages
		// 默认值是 https://api.anthropic.com/v1，自定义 proxy 也需要同样格式
		const rawBase = anthropicBase ?? "https://api.anthropic.com/v1";
		// 确保 baseURL 以 /v1 结尾（不含尾部斜杠）
		const normalizedBase = rawBase.replace(/\/+$/, "");
		const baseURL = normalizedBase.endsWith("/v1") ? normalizedBase : `${normalizedBase}/v1`;
		return {
			type: "anthropic",
			baseURL,
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
				// 修复 proxy 的 SSE index 偏移问题：
				// 某些 proxy 的 content_block_start/delta 从 index:1 开始而非 index:0，
				// AI SDK 解析时找不到 slot 导致输出为空。通过 fetch wrapper 在响应流里重写。
				fetch: async (url, init) => {
					const response = await fetch(url, init);
					const contentType = response.headers.get("content-type") ?? "";
					console.log("[AI-FETCH] url:", String(url).slice(0, 80), "status:", response.status, "ct:", contentType.slice(0, 40));
					if (!response.body || !contentType.includes("text/event-stream")) {
						return response;
					}
					console.log("[AI-FETCH] applying SSE index normalization");
					const decoder = new TextDecoder();
					const encoder = new TextEncoder();
					// 记录每个 index 第一次出现时的偏移量，归一化为从 0 开始
					const indexMap = new Map<number, number>();
					let nextNormalized = 0;
					const transformStream = new TransformStream({
						transform(chunk, controller) {
							const text = decoder.decode(chunk, { stream: true });
							const fixed = text.replace(/"index"\s*:\s*(\d+)/g, (_, n) => {
								const orig = Number(n);
								if (!indexMap.has(orig)) {
									indexMap.set(orig, nextNormalized++);
									if (orig !== 0) {
										console.log("[AI-FETCH] normalized index:", orig, "->", indexMap.get(orig));
									}
								}
								return `"index":${indexMap.get(orig)}`;
							});
							controller.enqueue(encoder.encode(fixed));
						},
					});
					return new Response(response.body.pipeThrough(transformStream), {
						status: response.status,
						statusText: response.statusText,
						headers: response.headers,
					});
				},
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

// 向后兼容的 model 实例导出
// 这些不能在模块顶层初始化（env 还没就绪），所以用 getter 形式暴露
// 调用方应改用 getTextModel() 等函数；这里保留兼容，实际会在第一次属性访问时懒加载
let _fastModelInstance: ReturnType<typeof createModel> | null = null;
let _textModelInstance: ReturnType<typeof createModel> | null = null;
let _reasoningModelInstance: ReturnType<typeof createModel> | null = null;

function getLazyFastModel() {
	if (!_fastModelInstance) _fastModelInstance = getFastModel();
	return _fastModelInstance;
}
function getLazyTextModel() {
	if (!_textModelInstance) _textModelInstance = getTextModel();
	return _textModelInstance;
}
function getLazyReasoningModel() {
	if (!_reasoningModelInstance) _reasoningModelInstance = getReasoningModel();
	return _reasoningModelInstance;
}

export const fastModel = new Proxy({} as ReturnType<typeof createModel>, {
	get(_, prop) {
		const m = getLazyFastModel();
		const val = Reflect.get(m, prop, m);
		return typeof val === "function" ? (val as Function).bind(m) : val;
	},
	has(_, prop) { return prop in getLazyFastModel(); },
});

export const textModel = new Proxy({} as ReturnType<typeof createModel>, {
	get(_, prop) {
		const m = getLazyTextModel();
		const val = Reflect.get(m, prop, m);
		return typeof val === "function" ? (val as Function).bind(m) : val;
	},
	has(_, prop) { return prop in getLazyTextModel(); },
});

export const reasoningModel = new Proxy({} as ReturnType<typeof createModel>, {
	get(_, prop) {
		const m = getLazyReasoningModel();
		const val = Reflect.get(m, prop, m);
		return typeof val === "function" ? (val as Function).bind(m) : val;
	},
	has(_, prop) { return prop in getLazyReasoningModel(); },
});

export * from "ai";
export * from "./lib";
