import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

// ── Bedrock 兼容性：从请求体里递归删除它拒绝的 JSON Schema 约束字段 ──
//
// 触发场景：
//   "ValidationException: For 'number' type, properties maximum, minimum are not supported"
//   "ValidationException: For 'array' type, 'minItems' values other than 0 or 1 are not supported"
//
// 我们走的是 Anthropic 协议，但底层路由到 AWS Bedrock 的 Claude。Bedrock 对 tool
// inputSchema 和 Output.object 的 JSON Schema 限制比 Anthropic 原生 API 更严格。
//
// 策略：只删 LLM 用不到、Bedrock 又不接受的「数值范围/长度」约束，保留 type/required/
// properties 等结构信息。这样 Bedrock 不会拒，LLM 不会迷惑，业务侧 zod 校验仍生效。
const STRIPPED_KEYS = new Set([
	"minimum",
	"maximum",
	"exclusiveMinimum",
	"exclusiveMaximum",
	"minItems",
	"maxItems",
	"minLength",
	"maxLength",
	"minProperties",
	"maxProperties",
	"multipleOf",
]);

function stripJsonSchemaConstraints(node: unknown): unknown {
	if (!node || typeof node !== "object") return node;
	if (Array.isArray(node)) {
		for (const item of node) stripJsonSchemaConstraints(item);
		return node;
	}
	const obj = node as Record<string, unknown>;
	for (const key of Object.keys(obj)) {
		if (STRIPPED_KEYS.has(key)) {
			delete obj[key];
		} else {
			stripJsonSchemaConstraints(obj[key]);
		}
	}
	return obj;
}

export function __test_sanitizeAnthropicBody(init: RequestInit | undefined): RequestInit | undefined {
	return sanitizeAnthropicBody(init);
}

function sanitizeAnthropicBody(init: RequestInit | undefined): RequestInit | undefined {
	if (!init?.body || typeof init.body !== "string") return undefined;
	try {
		const parsed = JSON.parse(init.body) as Record<string, unknown>;
		// 只处理可能含 schema 的字段：tools[i].input_schema 和顶层 output_config（如有）
		const tools = parsed.tools;
		if (Array.isArray(tools)) {
			for (const t of tools as Array<Record<string, unknown>>) {
				if (t.input_schema) stripJsonSchemaConstraints(t.input_schema);
			}
		}
		if (parsed.output_config) stripJsonSchemaConstraints(parsed.output_config);
		// AI SDK 的 Output.object 也会以特殊 tool 形式塞进 tools，已被上面循环覆盖
		return { ...init, body: JSON.stringify(parsed) };
	} catch {
		return undefined;
	}
}

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
					// ── 上行 sanitize：剥掉 Bedrock 不接受的 schema 约束 ──
					// AWS Bedrock 拒绝以下字段：
					//   - number 上的 minimum/maximum
					//   - array 上的 minItems（除了 0/1）和 maxItems
					//   - 也观察到对 string 的 minLength/maxLength 不友好
					// 这些字段在客户端 zod 仍生效（防呆），只是不传给 LLM/Bedrock。
					// 比改 N 处业务 schema 更稳，覆盖所有 tool inputSchema + Output.object schema。
					const effectiveInit = sanitizeAnthropicBody(init) ?? init;
					// 代理偶发 422 / 5xx：自动重试最多 3 次，指数退避（800ms → 2s → 4s）
					// 背景：yxai.anthropic.edu.pl 等代理在 tool calling + 较长 prompt 时
					// 会反复 504 Gateway Time-out / 422 "Upstream request failed"。
					// AI SDK 默认认为 422 不可重试；这里在 fetch 层兜底，对调用方透明。
					const RETRYABLE = new Set([408, 422, 425, 429, 500, 502, 503, 504]);
					const BACKOFFS_MS = [800, 2000, 4000];
					let response = await fetch(url, effectiveInit);
					let firstErrBody = "";
					for (let attempt = 0; attempt < BACKOFFS_MS.length; attempt++) {
						if (!RETRYABLE.has(response.status)) {
							break;
						}
						const errBody = await response.clone().text().catch(() => "");
						if (attempt === 0) firstErrBody = errBody;
						const wait = BACKOFFS_MS[attempt];
						console.warn(
							`[anthropic-proxy] ${response.status} (attempt ${attempt + 1}/${BACKOFFS_MS.length + 1}), retrying after ${wait}ms. body=${errBody.slice(0, 160)}`,
						);
						await new Promise((r) => setTimeout(r, wait));
						response = await fetch(url, effectiveInit);
						if (response.ok) {
							console.log(`[anthropic-proxy] retry attempt ${attempt + 1} succeeded`);
							break;
						}
					}
					if (!response.ok && RETRYABLE.has(response.status)) {
						console.error(`[anthropic-proxy] all ${BACKOFFS_MS.length + 1} attempts failed with ${response.status}`);
						// 422 Vertex schema 错误：dump request body 中的 tool_use 内容用于排查
						if (response.status === 422 && firstErrBody.includes("tool_use.input") && effectiveInit?.body) {
							try {
								const bodyStr = typeof effectiveInit.body === "string" ? effectiveInit.body : "";
								if (bodyStr) {
									const parsed = JSON.parse(bodyStr);
									const msgs = (parsed.messages ?? []) as Array<{ role: string; content: unknown }>;
									msgs.forEach((m, i) => {
										if (!Array.isArray(m.content)) return;
										(m.content as Array<{ type: string; id?: string; name?: string; input?: unknown }>).forEach((c, j) => {
											if (c.type === "tool_use") {
												const inputType = typeof c.input;
												const inputPreview = JSON.stringify(c.input).slice(0, 300);
												console.error(`[anthropic-proxy] DUMP msg[${i}].content[${j}] tool_use name=${c.name} id=${c.id} inputType=${inputType} input=${inputPreview}`);
											}
										});
									});
								}
							} catch (e) {
								console.error(`[anthropic-proxy] DUMP failed: ${e instanceof Error ? e.message : String(e)}`);
							}
						}
					}
					const contentType = response.headers.get("content-type") ?? "";
					if (!response.body || !contentType.includes("text/event-stream")) {
						return response;
					}
					// 修复 proxy SSE index 偏移：只处理 content_block 事件中的 index
					// proxy 的 content_block_start/delta index 从 1 开始，SDK 期望从 0 开始
					const decoder = new TextDecoder();
					const encoder = new TextEncoder();
					let buffer = "";
					const transformStream = new TransformStream({
						transform(chunk, controller) {
							buffer += decoder.decode(chunk, { stream: true });
							// 按 SSE 事件分割处理（双换行分隔）
							const parts = buffer.split("\n\n");
							buffer = parts.pop() ?? "";
							for (const part of parts) {
								let output = part;
								// 只对 content_block 事件修正 index
								if (part.includes("content_block_start") || part.includes("content_block_delta") || part.includes("content_block_stop")) {
									output = part.replace(/"index"\s*:\s*(\d+)/, (_, n) => {
										const fixed = Math.max(0, Number(n) - 1);
										return `"index":${fixed}`;
									});
								}
								controller.enqueue(encoder.encode(output + "\n\n"));
							}
						},
						flush(controller) {
							if (buffer.trim()) {
								controller.enqueue(encoder.encode(buffer));
							}
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

/**
 * 专用回复起草模型：GPT-5.4（通过独立 API key 调用）。
 * 回复邮件 GPT 更擅长自然语言生成，Agent 主体保持 Claude。
 */
export function getReplyDraftModel() {
	const apiKey = process.env.AI_REPLY_API_KEY;
	const baseURL = process.env.AI_REPLY_BASE_URL ?? "https://api.openai.com/v1";
	const modelName = process.env.AI_REPLY_MODEL ?? "gpt-5.4";

	if (apiKey) {
		const provider = createOpenAI({ baseURL, apiKey });
		return provider.chat(modelName);
	}
	return createModel("AI_REPLY_MODEL", "claude-sonnet-4-6", "gpt-4o");
}

// 向后兼容的 model 实例导出
// 这些不能在模块顶层初始化（env 还没就绪），所以用 getter 形式暴露
// 调用方应改用 getTextModel() 等函数；这里保留兼容，实际会在第一次属性访问时懒加载
let _fastModelInstance: ReturnType<typeof createModel> | null = null;
let _textModelInstance: ReturnType<typeof createModel> | null = null;
let _reasoningModelInstance: ReturnType<typeof createModel> | null = null;
let _replyDraftModelInstance: ReturnType<typeof getReplyDraftModel> | null = null;

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
