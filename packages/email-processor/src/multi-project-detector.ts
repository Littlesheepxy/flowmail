import { fastModel, safeGenerateObject } from "@repo/ai";
import { z } from "zod";

const SubProjectSchema = z.object({
	title: z.string().describe("子项目/子事项名称，5-30 字"),
	summary: z.string().describe("该子项目的简要进展/状态描述，30-150 字"),
	keywords: z
		.array(z.string())
		.optional()
		.describe("用于后续匹配同类邮件的关键词，2-5 个"),
});

export const MultiProjectDetectionSchema = z.object({
	hasMultipleProjects: z
		.boolean()
		.describe("邮件正文/附件是否包含 2 个或以上明显独立的子项目/事项"),
	confidence: z.number().min(0).max(1),
	reasoning: z.string().describe("判断依据，1-2 句话"),
	subProjects: z
		.array(SubProjectSchema)
		.optional()
		.describe("如果 hasMultipleProjects=true，列出检测到的所有子项目"),
});

export type MultiProjectDetection = z.infer<typeof MultiProjectDetectionSchema>;
export type SubProjectCandidate = z.infer<typeof SubProjectSchema>;

/**
 * Detect whether an email body (with attachments concatenated) contains
 * multiple independent sub-projects.
 *
 * Triggers on: subsidiary monthly reports listing multiple projects, batch
 * status updates covering several initiatives, etc.
 */
export async function detectMultipleProjects(input: {
	subject: string;
	content: string;
}): Promise<MultiProjectDetection> {
	if (!input.content || input.content.trim().length < 200) {
		return {
			hasMultipleProjects: false,
			confidence: 1,
			reasoning: "内容过短，不可能包含多个项目",
		};
	}

	try {
		return await safeGenerateObject({
			model: fastModel,
			schema: MultiProjectDetectionSchema,
			prompt: `你是一个企业邮件分析助手。请判断这封邮件是否包含 2 个或更多**完全独立**的子项目/事项需要分别追踪。

判断标准：
- ✅ 是多项目：子公司汇报里逐条列出多个不相关项目（如「项目 A 进展…项目 B 进展…项目 C 进展」）；周报里包含多个独立线条；多产品线分别说明
- ❌ 不是多项目：单个项目的多个阶段/任务；同一项目下的多个 todo；附件只是支撑材料；同一议题的多个角度

只有当真正存在「分别需要独立追踪」的多个项目时才返回 true。如果是单个项目的多方面，返回 false。

邮件主题：${input.subject}
邮件正文与附件（前 4000 字）：
${input.content.slice(0, 4000)}

如果 hasMultipleProjects=true，请准确列出所有检测到的子项目，每个含 title（精简标题）、summary（该子项目在本邮件中的进展摘要）、keywords（用于以后识别同类邮件的关键词）。`,
		});
	} catch (err) {
		console.warn(
			"[MultiProjectDetector] Failed:",
			err instanceof Error ? err.message : String(err),
		);
		return {
			hasMultipleProjects: false,
			confidence: 0,
			reasoning: "检测失败：" + (err instanceof Error ? err.message : String(err)),
		};
	}
}
