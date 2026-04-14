import type { ToolSet } from "@repo/ai";
import { z } from "zod";
import { MemoryManager } from "../memory/manager";

const memoryManager = new MemoryManager();

export function createMemoryTools(): ToolSet {
	return {
		upsert_memory_object: {
			description: `更新或创建一个结构化记忆对象。Agent 应在识别到新信息时主动调用：
- self: 用户的画像（角色、写作风格、工作习惯、语气偏好）。objectId 传 userId。
- person: 联系人画像。objectId 传联系人邮箱。
- project: 项目信息。objectId 传项目名的 slug。
- event: 关键事件。objectId 传简短事件标识。
- preference: 业务规则。objectId 传规则名的 slug。
- decision: 决策记录。objectId 传简短决策标识。
updates 是一个 key-value 对象，只传需要更新的字段。已有字段会合并，不会覆盖未传的字段。`,
			inputSchema: z.object({
				organizationId: z.string().describe("组织 ID"),
				objectType: z.string().describe("对象类型: self | person | project | event | preference | decision"),
				objectId: z.string().describe("对象标识符: userId / 邮箱 / slug"),
				name: z.string().describe("显示名称"),
				updates: z.record(z.string(), z.unknown()).describe("要更新的属性键值对"),
			}),
			execute: async ({ organizationId, objectType, objectId, name, updates }: {
				organizationId: string;
				objectType: string;
				objectId: string;
				name: string;
				updates: Record<string, unknown>;
			}) => {
				try {
					const result = await memoryManager.upsertObject({
						organizationId,
						objectType,
						objectId,
						name,
						updates,
					});

					return {
						success: true,
						isNew: result.isNew,
						changedFields: result.changedFields,
						_memoryWritten: true,
					};
				} catch (err) {
					return {
						success: false,
						error: err instanceof Error ? err.message : "Unknown error",
					};
				}
			},
		},
	};
}
