import { config } from "dotenv";
config({ path: new URL("../../../.env.local", import.meta.url).pathname });

import { z } from "zod";
import { generateText, tool, getFastModel, getReasoningModel } from "../index";

async function testPlain() {
	console.log("\n=== TEST 1: plain generateText (haiku) ===");
	const t0 = Date.now();
	const r = await generateText({
		model: getFastModel(),
		prompt: "回复一个字：好",
	});
	console.log(`✓ haiku ${Date.now() - t0}ms ->`, r.text);
}

async function testWithTool() {
	console.log("\n=== TEST 2: generateText + tool with constrained schema (opus) ===");
	const t0 = Date.now();
	const r = await generateText({
		model: getReasoningModel(),
		prompt: "请调用 find_pairs 工具，参数 { entityIds: ['a','b','c'], maxItems: 5 }，返回任意一组配对",
		tools: {
			find_pairs: tool({
				description: "Find duplicate entity pairs",
				inputSchema: z.object({
					entityIds: z.array(z.string()).min(2).max(50).describe("要扫描的事项 id 列表"),
					maxItems: z.number().min(1).max(20).default(5).describe("最多返回组数"),
				}),
				execute: async ({ entityIds, maxItems }) => {
					return {
						pairs: [
							{ a: entityIds[0], b: entityIds[1], confidence: 0.85, reason: "test" },
						].slice(0, maxItems),
					};
				},
			}),
		},
		stopWhen: ({ steps }) => steps.length >= 3,
	});
	console.log(`✓ opus+tool ${Date.now() - t0}ms steps=${r.steps?.length} text=`, r.text?.slice(0, 200));
}

async function main() {
	console.log("base:", process.env.ANTHROPIC_BASE_URL);
	console.log("token:", process.env.ANTHROPIC_AUTH_TOKEN?.slice(0, 12) + "...");
	console.log("FAST:", process.env.AI_FAST_MODEL, "REASONING:", process.env.AI_REASONING_MODEL);
	try {
		await testPlain();
	} catch (e) {
		console.error("✗ TEST 1 FAILED:", e instanceof Error ? e.message : e);
	}
	try {
		await testWithTool();
	} catch (e) {
		console.error("✗ TEST 2 FAILED:", e instanceof Error ? e.message : e);
	}
}

main().catch((e) => {
	console.error("fatal:", e);
	process.exit(1);
});
