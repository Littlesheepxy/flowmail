import { describe, expect, it } from "vitest";
import { __test_sanitizeAnthropicBody as sanitize } from "../index";

const make = (body: unknown): RequestInit => ({
	method: "POST",
	body: JSON.stringify(body),
});

const parse = (init: RequestInit) => JSON.parse(init.body as string);

describe("sanitizeAnthropicBody", () => {
	it("不动没有 schema 的请求", () => {
		const init = make({ model: "claude-haiku-4-5", messages: [] });
		const out = sanitize(init);
		expect(out).toBeDefined();
		expect(parse(out as RequestInit)).toEqual({ model: "claude-haiku-4-5", messages: [] });
	});

	it("剥掉 tools[i].input_schema 里的 minimum/maximum", () => {
		const init = make({
			tools: [
				{
					name: "foo",
					input_schema: {
						type: "object",
						properties: {
							confidence: { type: "number", minimum: 0, maximum: 1 },
							name: { type: "string", description: "x" },
						},
					},
				},
			],
		});
		const body = parse(sanitize(init) as RequestInit);
		const props = body.tools[0].input_schema.properties;
		expect(props.confidence).toEqual({ type: "number" });
		expect(props.name).toEqual({ type: "string", description: "x" });
	});

	it("剥掉 array 里的 minItems/maxItems，保留 items 子 schema", () => {
		const init = make({
			tools: [
				{
					name: "ask_user",
					input_schema: {
						type: "object",
						properties: {
							options: {
								type: "array",
								minItems: 2,
								maxItems: 5,
								items: { type: "string" },
							},
						},
					},
				},
			],
		});
		const body = parse(sanitize(init) as RequestInit);
		const opts = body.tools[0].input_schema.properties.options;
		expect(opts).toEqual({ type: "array", items: { type: "string" } });
	});

	it("剥掉 string 里的 minLength/maxLength", () => {
		const init = make({
			tools: [
				{
					input_schema: {
						type: "object",
						properties: { name: { type: "string", minLength: 1, maxLength: 50 } },
					},
				},
			],
		});
		const body = parse(sanitize(init) as RequestInit);
		expect(body.tools[0].input_schema.properties.name).toEqual({ type: "string" });
	});

	it("递归剥嵌套 properties / items / object 里的 array", () => {
		const init = make({
			tools: [
				{
					input_schema: {
						type: "object",
						properties: {
							groups: {
								type: "array",
								maxItems: 10,
								items: {
									type: "object",
									properties: {
										ids: { type: "array", minItems: 2, items: { type: "string" } },
										conf: { type: "number", minimum: 0, maximum: 1 },
									},
								},
							},
						},
					},
				},
			],
		});
		const body = parse(sanitize(init) as RequestInit);
		const groups = body.tools[0].input_schema.properties.groups;
		expect(groups.maxItems).toBeUndefined();
		expect(groups.items.properties.ids).toEqual({
			type: "array",
			items: { type: "string" },
		});
		expect(groups.items.properties.conf).toEqual({ type: "number" });
	});

	it("不破坏 type/required/description/enum/properties", () => {
		const init = make({
			tools: [
				{
					input_schema: {
						type: "object",
						required: ["a", "b"],
						description: "x",
						properties: {
							a: { type: "string", enum: ["x", "y"] },
							b: { type: "number", minimum: 0 },
						},
					},
				},
			],
		});
		const body = parse(sanitize(init) as RequestInit);
		const s = body.tools[0].input_schema;
		expect(s.required).toEqual(["a", "b"]);
		expect(s.description).toBe("x");
		expect(s.properties.a).toEqual({ type: "string", enum: ["x", "y"] });
		expect(s.properties.b).toEqual({ type: "number" });
	});

	it("body 不是字符串时返回 undefined", () => {
		expect(sanitize({ method: "POST", body: new Uint8Array() } as unknown as RequestInit)).toBeUndefined();
	});

	it("body 是无效 JSON 时返回 undefined（不抛错）", () => {
		expect(sanitize({ method: "POST", body: "not json{" })).toBeUndefined();
	});
});
