import { z } from "zod";
import { generateText, Output } from "ai";

/**
 * 0~1 之间的置信度，**不带 min/max 约束**。
 *
 * 为什么不直接用 z.number().min(0).max(1)：
 * 当 schema 通过 Output.object/tool-calling 传给 AWS Bedrock 时，会被序列化成
 * JSON Schema { type: "number", minimum: 0, maximum: 1 } —— Bedrock 拒绝
 * "For 'number' type, properties maximum, minimum are not supported"。
 * 用 transform 在客户端 clamp，保留运行期保护，绕开 schema 限制。
 */
export const zConfidence = (description = "0~1 之间的置信度") =>
	z
		.number()
		.transform((n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0)))
		.describe(description);

/**
 * 整数计数（≥0），不带 min/max 约束（同 zConfidence 的理由）。
 */
export const zNonNegInt = (description?: string) => {
	const base = z
		.number()
		.transform((n) => Math.max(0, Math.floor(Number.isFinite(n) ? n : 0)));
	return description ? base.describe(description) : base;
};

/**
 * 数组（带数量约束），但不会把 minItems/maxItems 写进 JSON Schema。
 *
 * Bedrock 限制：array 的 minItems 只允许 0/1，maxItems 任意值都不接受。
 *   `For 'array' type, 'minItems' values other than 0 or 1 are not supported`
 *
 * 解决方式：用 transform 在客户端做截断（max）和填充检查（min 改成 describe 提示），
 * 然后用 describe 把数量要求写进 prompt 给 LLM 看到。
 *
 * 用法：
 *   zArray(z.string(), { min: 2, max: 5, describe: "选项列表" })
 */
export const zArray = <T extends z.ZodType>(
	item: T,
	opts: { min?: number; max?: number; describe?: string } = {},
) => {
	const { min, max, describe } = opts;
	const hint = [
		min !== undefined ? `至少 ${min} 项` : null,
		max !== undefined ? `最多 ${max} 项` : null,
	]
		.filter(Boolean)
		.join("，");
	const fullDesc = [describe, hint].filter(Boolean).join("（") + (hint ? "）" : "");
	const base = z
		.array(item)
		.transform((arr) =>
			max !== undefined && arr.length > max ? arr.slice(0, max) : arr,
		);
	return fullDesc ? base.describe(fullDesc) : base;
};

/**
 * Wraps generateText + Output.object with a fallback for providers/proxies
 * that don't support tool calling (which Output.object relies on for Anthropic).
 *
 * Strategy:
 * 1. Try Output.object (tool-based structured output) — ideal path
 * 2. On failure, retry with explicit JSON instructions in the prompt
 *    and parse the text response manually with zod validation
 */
// 默认走 Output.object（tool-calling 结构化输出），最稳。
// 如果代理不支持 tool-calling（实测某些代理会持续 422 / "No object generated"），
// 设 AI_SKIP_OUTPUT_OBJECT=1 直接走 prompt-based，省掉每次失败的 10-40s。
const SKIP_OUTPUT_OBJECT = process.env.AI_SKIP_OUTPUT_OBJECT === "1";

export async function safeGenerateObject<T extends z.ZodType>(options: {
	model: Parameters<typeof generateText>[0]["model"];
	schema: T;
	prompt: string;
	system?: string;
}): Promise<z.infer<T>> {
	if (SKIP_OUTPUT_OBJECT) {
		return generatePromptBasedJson(options);
	}
	try {
		const { output } = await generateText({
			model: options.model,
			output: Output.object({ schema: options.schema }),
			prompt: options.prompt,
			system: options.system,
		});
		return output as z.infer<T>;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const isStructuredOutputFailure =
			message.includes("not valid JSON") ||
			message.includes("Unexpected token") ||
			message.includes("output failed to parse") ||
			message.includes("No object generated") ||
			message.includes("could not parse") ||
			message.includes("tool_use") ||
			// Zod 校验失败：LLM 给了 JSON 但字段类型不符（如 array<string> 给成 string）
			// 走 fallback 才能用 coerceToSchema 修复
			message.includes("invalid_type") ||
			message.includes("Invalid input") ||
			message.includes("expected array") ||
			message.includes("expected string") ||
			message.includes("expected object");

		if (!isStructuredOutputFailure) {
			throw err;
		}

		console.warn(
			"[AI] Output.object failed (proxy likely doesn't support tool calling), falling back to prompt-based JSON:",
			message.slice(0, 120),
		);

		return generatePromptBasedJson(options);
	}
}

async function generatePromptBasedJson<T extends z.ZodType>(options: {
	model: Parameters<typeof generateText>[0]["model"];
	schema: T;
	prompt: string;
	system?: string;
}): Promise<z.infer<T>> {
	const schemaExample = schemaToExample(options.schema);
	const jsonPrompt = `${options.prompt}

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanation, no extra text — ONLY the raw JSON object.

You MUST follow this EXACT JSON structure (use the same field names and types):
${schemaExample}`;

	const { text } = await generateText({
		model: options.model,
		prompt: jsonPrompt,
		system: options.system,
	});

	const parsed = extractJson(text);
	const result = options.schema.safeParse(parsed);
	if (result.success) {
		return result.data;
	}

	console.warn(
		"[AI] Strict parse failed, attempting coercion:",
		result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
	);
	const coerced = coerceToSchema(parsed as Record<string, unknown>, options.schema);
	const coercedResult = options.schema.safeParse(coerced);
	if (coercedResult.success) {
		return coercedResult.data;
	}

	console.warn(
		"[AI] Coercion still failed, attempting default-skeleton fill:",
		coercedResult.error.issues
			.map((i) => `${i.path.join(".")}: ${i.message}`)
			.join("; "),
	);
	const skeleton = buildDefaultObject(options.schema);
	const merged = { ...skeleton, ...(coerced as Record<string, unknown>) };
	const finalCoerced = coerceToSchema(merged, options.schema);
	const finalResult = options.schema.safeParse(finalCoerced);
	if (finalResult.success) {
		return finalResult.data;
	}
	throw new Error(
		`AI output parse failed after coercion + skeleton fill: ${finalResult.error.issues
			.map((i) => `${i.path.join(".")}: ${i.message}`)
			.join("; ")}`,
	);
}

function extractJson(text: string): unknown {
	const trimmed = text.trim();

	const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
	const raw = fenceMatch ? fenceMatch[1].trim() : trimmed;

	const start = raw.indexOf("{");
	const end = raw.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) {
		throw new Error(`No JSON object found in AI response: ${raw.slice(0, 200)}`);
	}

	return JSON.parse(raw.slice(start, end + 1));
}

// ── Zod introspection helpers ──
// Zod 4 uses _def.type (e.g. "string", "enum", "object")
// Zod 3 uses _def.typeName (e.g. "ZodString", "ZodEnum", "ZodObject")
// We support both for forward/backward compatibility.

interface ZodDef {
	type?: string;
	typeName?: string;
	entries?: Record<string, string>;
	values?: string[];
	innerType?: z.ZodType;
	description?: string;
}

function getDef(t: z.ZodType): ZodDef | undefined {
	return (t as { _def?: ZodDef })._def;
}

function defType(def: ZodDef): string {
	return def.type ?? def.typeName?.replace("Zod", "").toLowerCase() ?? "";
}

// 剥离修饰符（pipe/transform/optional/nullable/default/readonly/catch/effects）
// 拿到底层 schema 用于类型识别。
//
// zod 4 行为（2026-04 实测）：
//   z.array(z.string()).transform(...) → _def.type="pipe", _def.in=ZodArray, _def.out=ZodTransform
//   z.string().optional()              → _def.type="optional", _def.innerType=ZodString
//   z.string().default("x")            → _def.type="default", _def.innerType=ZodString
//
// 关键：pipe 必须取 _def.in（用户暴露的"输入"类型，array），不能取 _def.out
// （那是 transform 包裹层，再剥就变成 _def.transform=function 了）。
function unwrapSchema(t: z.ZodType): z.ZodType {
	let current: z.ZodType = t;
	for (let i = 0; i < 10; i++) {
		const d = getDef(current);
		if (!d) {
			return current;
		}
		const ft = defType(d);
		const any = d as Record<string, unknown>;

		// pipe: { in, out } —— 取 in（输入侧的 schema 才是 array/object/enum 等）
		if (ft === "pipe") {
			const inner = any.in as z.ZodType | undefined;
			if (inner && typeof inner.safeParse === "function") {
				current = inner;
				continue;
			}
			return current;
		}

		// 其他修饰符：内层在 innerType
		if (
			ft === "optional" ||
			ft === "nullable" ||
			ft === "default" ||
			ft === "readonly" ||
			ft === "catch" ||
			ft === "transform" ||
			ft === "effects"
		) {
			const inner =
				(any.innerType as z.ZodType | undefined) ??
				(any.schema as z.ZodType | undefined);
			if (inner && typeof inner.safeParse === "function") {
				current = inner;
				continue;
			}
			return current;
		}

		return current;
	}
	return current;
}

function getEnumValues(def: ZodDef): string[] {
	if (def.entries) {
		return Object.values(def.entries);
	}
	if (def.values && Array.isArray(def.values)) {
		return def.values;
	}
	return [];
}

function getArrayItemSchema(t: z.ZodType): z.ZodType | undefined {
	const u = unwrapSchema(t);
	const d = getDef(u);
	if (!d) {
		return undefined;
	}
	// Zod 4: _def.element, Zod 3: _def.type
	const any = d as Record<string, unknown>;
	return (any.element ?? any.type) as z.ZodType | undefined;
}

// ── Coercion ──

// 把 LLM 拍扁的字符串 "a; b; c" / "a, b, c" / "1. x\n2. y" 拆成数组。
// 关键约束：不能误拆千分位逗号（"Revenue 1,234,567 USD" 必须保持一条）。
function splitFlattenedArray(input: string): string[] {
	const trimmed = input.trim();
	if (trimmed === "") {
		return [];
	}

	// 第 1 步：按"强分隔符"拆（分号、换行）
	const strongParts = trimmed
		.split(/[;；\n]+/)
		.map((s) => s.trim())
		.filter(Boolean);

	// 第 2 步：每段如果含"安全的"逗号（不是千分位），再拆一次
	const out: string[] = [];
	for (const seg of strongParts) {
		// 千分位特征：纯数字加 , 加 3 位数字（"1,234" / "1,234,567"）
		// 简单办法：看每个 , 两侧字符——如果两侧都是数字就当千分位
		if (/[,，]/.test(seg) && !/^[0-9,，.\s]+$/.test(seg)) {
			// 用回调避免分割数字内逗号：把所有"数字,数字"形式的逗号替换为占位符。
			// 用循环替换处理 "1,234,567" 这种多组千分位（一次 replace 不够，
			// 因为相邻 group 的字符会被消费）。
			// 用极不可能在文本中出现的占位符（私有使用区码点）替代千分位逗号
			const PLACEHOLDER = "\uE000COMMA\uE000";
			let protectedSeg = seg;
			let prev: string;
			do {
				prev = protectedSeg;
				protectedSeg = protectedSeg.replace(
					/(\d)[,，](\d)/g,
					`$1${PLACEHOLDER}$2`,
				);
			} while (protectedSeg !== prev);
			const subParts = protectedSeg
				.split(/[,，]+/)
				.map((s) => s.split(PLACEHOLDER).join(",").trim())
				.filter(Boolean);
			out.push(...subParts);
		} else {
			out.push(seg);
		}
	}

	// 第 3 步：去 bullet 前缀（"1. " / "- " / "• " 等）
	const cleaned = out
		.map((s) => s.replace(/^[\s\-•·*]+|^\d+[.)]\s*/g, "").trim())
		.filter(Boolean);

	return cleaned.length > 0 ? cleaned : [trimmed];
}

function coerceToSchema(data: Record<string, unknown>, schema: z.ZodType): Record<string, unknown> {
	const unwrappedRoot = unwrapSchema(schema);
	const def = getDef(unwrappedRoot);
	if (!def || defType(def) !== "object" || !("shape" in unwrappedRoot)) {
		return data;
	}

	const shape = unwrappedRoot.shape as Record<string, z.ZodType>;
	const result = { ...data };

	for (const [key, rawFieldSchema] of Object.entries(shape)) {
		// 剥掉 .transform()/.optional()/.default() 等，否则 array/enum/object 都识别不出
		const fieldSchema = unwrapSchema(rawFieldSchema);
		const fd = getDef(fieldSchema);
		if (!fd) {
			continue;
		}

		const value = result[key];
		const ft = defType(fd);

		if (ft === "object" && (value === null || value === undefined || typeof value === "string")) {
			result[key] = buildDefaultObject(fieldSchema, typeof value === "string" ? value : undefined);
		}

		if (ft === "enum" && typeof value === "string") {
			const validValues = getEnumValues(fd);
			if (validValues.length > 0 && !validValues.includes(value)) {
				const lower = value.toLowerCase().replace(/[\s_-]/g, "_");
				const match = validValues.find((v) => v.toLowerCase() === lower);
				result[key] = match ?? validValues[0];
			}
		}

		if (ft === "array") {
			// LLM 时不时把 array<string> 拍扁成 "a; b; c" / "a, b" / 甚至单条字符串。
			// Schema 用 .max(N) 约束的话，硬解析会拿到「expected array, received string」。
			if (value === null || value === undefined) {
				result[key] = [];
			} else if (typeof value === "string") {
				result[key] = splitFlattenedArray(value);
			} else if (!Array.isArray(value)) {
				// LLM 偶尔返回 { "0": "x", "1": "y" } 这种 object-as-array
				if (typeof value === "object") {
					result[key] = Object.values(value as Record<string, unknown>);
				} else {
					result[key] = [String(value)];
				}
			}
		}
	}

	return result;
}

function buildDefaultObject(schema: z.ZodType, hint?: string): Record<string, unknown> {
	const unwrapped = unwrapSchema(schema);
	if (!("shape" in unwrapped)) {
		return {};
	}
	const shape = unwrapped.shape as Record<string, z.ZodType>;
	const obj: Record<string, unknown> = {};
	for (const [key, rawFieldSchema] of Object.entries(shape)) {
		const fieldSchema = unwrapSchema(rawFieldSchema);
		const fd = getDef(fieldSchema);
		if (!fd) {
			continue;
		}
		const ft = defType(fd);
		switch (ft) {
			case "string":
				obj[key] = key === "name" && hint ? hint : key === "email" ? "unknown@unknown.com" : "";
				break;
			case "number":
				obj[key] = 0;
				break;
			case "boolean":
				obj[key] = false;
				break;
			case "enum":
				obj[key] = getEnumValues(fd)[0] ?? "";
				break;
			case "array":
				obj[key] = [];
				break;
			case "object":
				// 嵌套对象递归 build（reporter: { name, email } 等）
				obj[key] = buildDefaultObject(fieldSchema);
				break;
			case "optional":
				obj[key] = undefined;
				break;
			default:
				obj[key] = null;
		}
	}
	return obj;
}

// ── Schema example generation ──

function schemaToExample(schema: z.ZodType, depth = 0): string {
	const indent = "  ".repeat(depth);
	const inner = "  ".repeat(depth + 1);
	const unwrapped = unwrapSchema(schema);
	const def = getDef(unwrapped);

	if (!def) {
		return "{}";
	}

	if (defType(def) === "object" && "shape" in unwrapped) {
		const shape = unwrapped.shape as Record<string, z.ZodType>;
		const entries = Object.entries(shape).map(([key, val]) => {
			const example = fieldExample(val, depth + 1);
			return `${inner}"${key}": ${example}`;
		});
		return `{\n${entries.join(",\n")}\n${indent}}`;
	}

	return "{}";
}

function fieldExample(t: z.ZodType, depth: number): string {
	const u = unwrapSchema(t);
	const def = getDef(u);
	if (!def) {
		return `"..."`;
	}

	const ft = defType(def);
	switch (ft) {
		case "string":
			return `"${def.description ? `<${def.description}>` : "..."}"`;
		case "number":
			return "0";
		case "boolean":
			return "false";
		case "enum": {
			const vals = getEnumValues(def);
			return `"${vals[0] ?? "..."}"  /* one of: ${vals.map((v) => `"${v}"`).join(", ")} */`;
		}
		case "array": {
			const item = getArrayItemSchema(t);
			return `[${item ? fieldExample(item, depth) : `"..."`}]`;
		}
		case "optional":
		case "nullable":
			return `${fieldExample(def.innerType as z.ZodType, depth)}  /* optional, can be null */`;
		case "object":
			return schemaToExample(t, depth);
		default:
			return `"..."`;
	}
}

// Test-only exports
export const __test_unwrapSchema = unwrapSchema;
export const __test_coerceToSchema = coerceToSchema;
export const __test_buildDefaultObject = buildDefaultObject;

