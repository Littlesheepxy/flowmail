import { config } from "dotenv";
config({ path: new URL("../../../.env.local", import.meta.url).pathname });

import { z } from "zod";
import { fastModel, safeGenerateObject, zArray, zConfidence } from "../index";

const ResultSchema = z.object({
	groups: z
		.array(
			z.object({
				entityIds: zArray(z.string(), { min: 2, describe: "应被合并的 id 列表" }),
				primaryEntityId: z.string().describe("保留的主事项 id"),
				reason: z.string().transform((s) => s.slice(0, 250)).describe("理由"),
				confidence: zConfidence(),
			}),
		)
		.transform((arr) => arr.slice(0, 10))
		.describe("候选合并组，最多 10 组"),
	notes: z.string().optional().describe("备注"),
});

async function main() {
	console.log("base:", process.env.ANTHROPIC_BASE_URL);
	console.log("FAST model:", process.env.AI_FAST_MODEL);

	const lines = [
		"[1] id=ent_a 类别: 投资 标题: Blue Sky 4 月月报 摘要: 月度业绩汇报",
		"[2] id=ent_b 类别: 投资 标题: Blue Sky 5 月月报 摘要: 5 月业绩",
		"[3] id=ent_c 类别: 投资 标题: Blue Sky 6 月月报 摘要: 6 月业绩",
		"[4] id=ent_d 类别: 法务 标题: Acme 公司股权协议 摘要: 法务文件",
		"[5] id=ent_e 类别: 投资 标题: Foo Capital 项目 A 摘要: 不相关",
	].join("\n");

	const t0 = Date.now();
	try {
		const r = await safeGenerateObject({
			model: fastModel,
			schema: ResultSchema,
			prompt: `你是邮件项目合并发现器。下面是 5 个事项，请找出可合并组。

【判断】同一公司 + 同一类业务（如 月报系列）的不同期 → 合并。不同公司或不同业务线 → 不合并。

【清单】
${lines}

【输出】返回 groups 数组，每组 ≥2 个 id，confidence>=0.7。`,
		});
		console.log(`✓ DONE in ${Date.now() - t0}ms`);
		console.log(JSON.stringify(r, null, 2));
	} catch (e) {
		console.error(`✗ FAILED in ${Date.now() - t0}ms:`, e instanceof Error ? e.message : e);
		if (e instanceof Error && e.stack) console.error(e.stack.split("\n").slice(0, 8).join("\n"));
	}
}

main().catch((e) => {
	console.error("fatal:", e);
	process.exit(1);
});
