import { generateObject, textModel } from "@repo/ai";
import { z } from "zod";

export const SuggestionsOutputSchema = z.object({
	suggestions: z.array(
		z.object({
			intent: z.string(),
			message: z.string(),
			severity: z.enum(["info", "warning", "critical"]),
			actionLabel: z.string().optional(),
			actionTool: z.string().optional(),
			actionParams: z.string().optional(),
			actionConfirmRequired: z.boolean().optional(),
			actionLabel2: z.string().optional(),
			actionTool2: z.string().optional(),
			actionParams2: z.string().optional(),
			actionConfirmRequired2: z.boolean().optional(),
		}),
	),
});

export interface AISuggestion {
	id: string;
	intent: string;
	message: string;
	severity: "info" | "warning" | "critical";
	actions?: {
		label: string;
		tool: string;
		params: Record<string, unknown>;
		confirmRequired: boolean;
	}[];
	status: "pending" | "accepted" | "dismissed";
}

interface SuggesterInput {
	entityType: string;
	entityStatus: string;
	extractedFields: Record<string, unknown>;
	latestEmailContent: string;
	timelineSummary: string;
	availableTools: string[];
}

function flatToSuggestion(
	raw: z.infer<typeof SuggestionsOutputSchema>["suggestions"][number],
	idx: number,
): AISuggestion {
	const actions: AISuggestion["actions"] = [];

	if (raw.actionLabel && raw.actionTool) {
		let params: Record<string, unknown> = {};
		if (raw.actionParams) {
			try {
				params = JSON.parse(raw.actionParams);
			} catch {}
		}
		actions.push({
			label: raw.actionLabel,
			tool: raw.actionTool,
			params,
			confirmRequired: raw.actionConfirmRequired ?? true,
		});
	}

	if (raw.actionLabel2 && raw.actionTool2) {
		let params: Record<string, unknown> = {};
		if (raw.actionParams2) {
			try {
				params = JSON.parse(raw.actionParams2);
			} catch {}
		}
		actions.push({
			label: raw.actionLabel2,
			tool: raw.actionTool2,
			params,
			confirmRequired: raw.actionConfirmRequired2 ?? true,
		});
	}

	return {
		id: `sug_${Date.now()}_${idx}`,
		intent: raw.intent,
		message: raw.message,
		severity: raw.severity,
		actions: actions.length > 0 ? actions : undefined,
		status: "pending",
	};
}

export async function generateSuggestions(
	input: SuggesterInput,
): Promise<AISuggestion[]> {
	const { object } = await generateObject({
		model: textModel,
		schema: SuggestionsOutputSchema,
		prompt: `你是 Flowmail 的智能助手。根据当前事项的完整上下文，判断是否有需要用户注意或可以自动执行的事项。

当前事项：
- 类型: ${input.entityType}
- 状态: ${input.entityStatus}
- 提取字段: ${JSON.stringify(input.extractedFields)}

最新邮件内容:
${input.latestEmailContent}

历史时间线摘要:
${input.timelineSummary}

可用的工具: ${input.availableTools.join(", ")}

规则:
1. 输出 0~3 条建议，不要输出无意义的建议
2. 每条建议的 severity 必须准确反映紧急程度
3. actionTool 必须是上述可用工具之一
4. actionParams 是 JSON 字符串格式
5. 使用与邮件相同的语言
6. 如果没有值得提醒的事项，返回空 suggestions 数组
7. 建议应该是可操作的 — 告诉用户可以做什么`,
	});

	return object.suggestions.map((s, i) => flatToSuggestion(s, i));
}
