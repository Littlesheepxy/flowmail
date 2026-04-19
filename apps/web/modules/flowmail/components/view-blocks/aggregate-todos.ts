import type { TodoItemView } from "./TodoListBlock";

interface EntityLite {
	id: string;
	extractedFields?: string | null;
	timeline?: Array<{ id: string; type: string; metadata?: string | null; createdAt: Date | string }>;
}

const FIELD_TO_STATUS: Array<{ key: string; status: TodoItemView["status"]; label: string }> = [
	{ key: "blockers", status: "blocked", label: "阻塞" },
	{ key: "inProgressItems", status: "in_progress", label: "进行中" },
	{ key: "nextActions", status: "pending", label: "下一步" },
	{ key: "completedItems", status: "completed", label: "已完成" },
];

function asArray(v: unknown): string[] {
	if (Array.isArray(v)) {
		return v.filter((x): x is string => typeof x === "string");
	}
	return [];
}

/**
 * 把 entity.extractedFields 里的 nextActions/blockers/inProgressItems/completedItems
 * + 所有 ai_summary timeline 事件里的同名字段，合并成一个去重的 Todo 列表。
 *
 * - 去重 key = `${status}::${text}`
 * - 来源 source = 字段中文标签 + 时间（如有）
 * - timeline_event 中 metadata.kind === "todo_completed" 用来标记前端勾选过的 todo（避免再次出现为 pending）
 */
export function aggregateAutoTodos(entity: EntityLite): TodoItemView[] {
	const dedup = new Map<string, TodoItemView>();

	function push(text: string, status: TodoItemView["status"], source: string) {
		const trimmed = text.trim();
		if (!trimmed || trimmed.length > 300) {
			return;
		}
		const key = `${status === "completed" ? "completed" : "open"}::${trimmed}`;
		if (!dedup.has(key)) {
			dedup.set(key, {
				id: key,
				text: trimmed,
				status,
				source,
			});
		}
	}

	// 1. 主 entity extractedFields
	if (entity.extractedFields) {
		try {
			const fields = JSON.parse(entity.extractedFields) as Record<string, unknown>;
			for (const cfg of FIELD_TO_STATUS) {
				for (const text of asArray(fields[cfg.key])) {
					push(text, cfg.status, `事项 · ${cfg.label}`);
				}
			}
		} catch {
			/* ignore */
		}
	}

	// 2. timeline 中的 ai_summary metadata.extractedFields
	const completedTexts = new Set<string>();
	for (const ev of entity.timeline ?? []) {
		if (!ev.metadata) {
			continue;
		}
		let meta: Record<string, unknown>;
		try {
			meta = JSON.parse(ev.metadata);
		} catch {
			continue;
		}

		if (ev.type === "action_taken" && meta.kind === "todo_completed") {
			const todoId = meta.todoId as string | undefined;
			if (todoId) {
				completedTexts.add(todoId);
			}
			continue;
		}

		if (ev.type === "ai_summary") {
			const ef = meta.extractedFields as Record<string, unknown> | undefined;
			if (!ef) {
				continue;
			}
			const ts = new Date(ev.createdAt).toLocaleDateString("zh-CN", {
				month: "short",
				day: "numeric",
			});
			for (const cfg of FIELD_TO_STATUS) {
				for (const text of asArray(ef[cfg.key])) {
					push(text, cfg.status, `${ts} · ${cfg.label}`);
				}
			}
		}
	}

	// 3. 应用前端标记的 completed
	const result: TodoItemView[] = [];
	for (const item of dedup.values()) {
		if (completedTexts.has(item.id)) {
			result.push({ ...item, status: "completed" });
		} else {
			result.push(item);
		}
	}
	return result;
}
