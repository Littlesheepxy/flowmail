import type { z } from "zod";
import { generateText, Output } from "ai";

/**
 * Wraps generateText + Output.object with a fallback for providers/proxies
 * that don't support tool calling (which Output.object relies on for Anthropic).
 *
 * Strategy:
 * 1. Try Output.object (tool-based structured output) — ideal path
 * 2. On failure, retry with explicit JSON instructions in the prompt
 *    and parse the text response manually with zod validation
 */
export async function safeGenerateObject<T extends z.ZodType>(options: {
	model: Parameters<typeof generateText>[0]["model"];
	schema: T;
	prompt: string;
	system?: string;
}): Promise<z.infer<T>> {
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

		console.warn("[AI] Strict parse failed, attempting coercion:", result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
		const coerced = coerceToSchema(parsed as Record<string, unknown>, options.schema);
		const coercedResult = options.schema.safeParse(coerced);
		if (coercedResult.success) {
			return coercedResult.data;
		}

		// Coercion 仍失败：用 schema 默认骨架填充缺失字段，最后再尝试 parse。
		// 宁可拿到字段为空的结果，也比让整个 enrich 流程 500 强。
		console.warn(
			"[AI] Coercion still failed, attempting default-skeleton fill:",
			coercedResult.error.issues
				.map((i) => `${i.path.join(".")}: ${i.message}`)
				.join("; "),
		);
		const skeleton = buildDefaultObject(options.schema);
		const merged = { ...skeleton, ...(coerced as Record<string, unknown>) };
		// 把 skeleton 里缺的字段（coerce 后 array 是 string 之类）再 coerce 一遍
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

// 剥离修饰符（transform/pipe/optional/nullable/default/effects/refinement）拿到底层 schema。
// z.array(...).transform(...) 的外层 _def.type 是 "pipe" 而不是 "array"，
// 不剥的话 coerce 会把 array<string> 字段当陌生类型跳过 → LLM 给单字符串就修不了。
function unwrapSchema(t: z.ZodType): z.ZodType {
	let current: z.ZodType = t;
	for (let i = 0; i < 10; i++) {
		const d = getDef(current);
		if (!d) {
			return current;
		}
		const ft = defType(d);
		// pipe: { in, out } —— 取 out 才是用户暴露的最终类型
		// transform/effects/default/optional/nullable/readonly: 内层是 innerType / type / schema
		const any = d as Record<string, unknown>;
		const inner =
			(any.out as z.ZodType | undefined) ??
			(any.innerType as z.ZodType | undefined) ??
			(any.schema as z.ZodType | undefined) ??
			(any.type as z.ZodType | undefined);
		if (
			(ft === "pipe" ||
				ft === "transform" ||
				ft === "effects" ||
				ft === "default" ||
				ft === "optional" ||
				ft === "nullable" ||
				ft === "readonly" ||
				ft === "catch") &&
			inner &&
			typeof (inner as z.ZodType).safeParse === "function"
		) {
			current = inner;
			continue;
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
				const trimmed = value.trim();
				if (trimmed === "") {
					result[key] = [];
				} else {
					// 优先按常见分隔符拆；都没有就当成单条
					const parts = trimmed
						.split(/[;；\n]|(?:^|[^0-9])[,，](?!\d{3}\b)/)
						.map((s) => s.replace(/^[\s\-•·*\d.)]+/, "").trim())
						.filter(Boolean);
					result[key] = parts.length > 0 ? parts : [trimmed];
				}
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
