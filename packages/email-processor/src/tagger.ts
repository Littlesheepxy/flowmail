import { textModel, safeGenerateObject } from "@repo/ai";
import { z } from "zod";

const TagsOutputSchema = z.object({
	tags: z
		.array(z.string())
		.describe(
			"3-5 short, relevant tags extracted from the email content and metadata. Include people names, departments, projects, urgency levels, financial amounts, or other key dimensions.",
		),
});

export async function generateTags(params: {
	subject: string;
	content: string;
	sender?: string;
	extractedFields?: Record<string, unknown>;
}): Promise<string[]> {
	const fieldsStr = params.extractedFields
		? Object.entries(params.extractedFields)
				.filter(([k, v]) => v != null && k !== "_isDemo")
				.map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
				.join("\n")
		: "";

	const output = await safeGenerateObject({
		model: textModel,
		schema: TagsOutputSchema,
		prompt: `Extract 3-5 short, descriptive tags from this email. Tags should help categorize and find this item later.

Good tags: department names (市场部, 技术部), person names (张三), project names (Q3推广), urgency (紧急), topics (预算, 差旅), amounts (¥150K).
Bad tags: generic words (邮件, 内容, 信息), single characters, full sentences.

Subject: ${params.subject}
From: ${params.sender ?? "unknown"}
${fieldsStr ? `\nExtracted fields:\n${fieldsStr}` : ""}

Content (first 1500 chars):
${params.content.slice(0, 1500)}`,
	});

	return output.tags
		.map((t: string) => t.trim())
		.filter((t: string) => t.length > 0 && t.length <= 30);
}
