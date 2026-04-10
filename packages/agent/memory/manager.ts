import { db } from "@repo/database";
import type {
	MemoryEntry,
	MemoryCategory,
	MemoryScope,
	MemoryOrigin,
	RecallOptions,
} from "../core/types";
import { MEMORY_CATEGORIES, MEMORY_SCOPES } from "../core/types";

// ─── Write Params ───

export interface WriteMemoryParams {
	organizationId: string;
	category: MemoryCategory;
	scope?: MemoryScope;
	scopeId?: string;
	content: string;
	metadata?: Record<string, unknown>;
	importance?: number;
	expiresAt?: Date;
	origin?: MemoryOrigin;
}

export interface RecordClassificationParams {
	organizationId: string;
	emailSubject: string;
	sender: string;
	classification: string;
	confidence: number;
	userCorrected?: boolean;
	correctedTo?: string;
}

export interface RecordDecisionParams {
	organizationId: string;
	entityId: string;
	decision: string;
	userApproved?: boolean;
	userCorrection?: string;
	metadata?: Record<string, unknown>;
}

export interface RecordContactProfileParams {
	organizationId: string;
	contactEmail: string;
	content: string;
	metadata?: Record<string, unknown>;
	importance?: number;
}

export interface RecordInsightParams {
	organizationId: string;
	category: MemoryCategory;
	content: string;
	metadata?: Record<string, unknown>;
	scope?: MemoryScope;
	scopeId?: string;
	importance?: number;
	origin?: MemoryOrigin;
}

// ─── Claude Code 四分类对应的写入参数 ───

/** 用户画像：角色、专业度、工作习惯 */
export interface RecordUserProfileParams {
	organizationId: string;
	userId: string;
	content: string;
	metadata?: Record<string, unknown>;
}

/** 操作反馈：用户纠正了 Agent 或明确认可了某个操作 */
export interface RecordFeedbackParams {
	organizationId: string;
	/** correction: 用户否定了 Agent  |  confirmation: 用户接受了 Agent 的做法 */
	origin: "correction" | "confirmation";
	content: string;
	/** 为什么（用户给的理由，用于判断边界情况） */
	reason?: string;
	/** 适用范围（entityId / contactEmail / 全局） */
	scopeId?: string;
	scope?: MemoryScope;
	metadata?: Record<string, unknown>;
}

/** 业务背景：进展、截止日期、决策动机 */
export interface RecordProjectContextParams {
	organizationId: string;
	entityId?: string;
	content: string;
	/** 为什么（动机、约束条件） */
	reason?: string;
	metadata?: Record<string, unknown>;
	expiresAt?: Date;
}

/** 外部资源指针：联系人角色、邮箱习惯、外部系统 */
export interface RecordReferenceParams {
	organizationId: string;
	contactEmail?: string;
	content: string;
	metadata?: Record<string, unknown>;
}

// ─── Legacy compat (used by classifier MemoryRecaller interface) ───

export interface LegacyRecallParams {
	organizationId: string;
	query: string;
	type?: string;
	limit?: number;
}

const DECAY_THRESHOLD_DAYS = 30;
const MIN_IMPORTANCE = 1;

export class MemoryManager {
	// ─── Core Write ───

	async write(params: WriteMemoryParams): Promise<string> {
		const meta = {
			...(params.metadata ?? {}),
			...(params.origin ? { origin: params.origin } : {}),
		};
		const record = await db.agentMemory.create({
			data: {
				organizationId: params.organizationId,
				category: params.category,
				scope: params.scope ?? MEMORY_SCOPES.org,
				scopeId: params.scopeId,
				content: params.content,
				metadata: Object.keys(meta).length > 0
					? JSON.stringify(meta)
					: undefined,
				importance: params.importance ?? 5,
				expiresAt: params.expiresAt,
			},
		});
		return record.id;
	}

	// ─── Multi-dimensional Recall ───

	async recall(options: RecallOptions): Promise<MemoryEntry[]> {
		const where: Record<string, unknown> = {
			organizationId: options.organizationId,
		};

		if (options.categories && options.categories.length > 0) {
			where.category = { in: options.categories };
		}

		if (options.scope) {
			where.scope = options.scope.type;
			where.scopeId = options.scope.id;
		}

		if (options.minImportance) {
			where.importance = { gte: options.minImportance };
		}

		const now = new Date();
		where.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];

		if (options.query) {
			const keywords = options.query
				.split(/\s+/)
				.filter((w) => w.length > 1);
			if (keywords.length > 0) {
				where.AND = keywords.map((kw) => ({
					content: { contains: kw, mode: "insensitive" },
				}));
			}
		}

		const records = await db.agentMemory.findMany({
			where,
			orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
			take: options.limit ?? 10,
		});

		if (records.length > 0) {
			const ids = records.map((r) => r.id);
			await db.agentMemory
				.updateMany({
					where: { id: { in: ids } },
					data: {
						accessCount: { increment: 1 },
						lastAccessedAt: now,
					},
				})
				.catch(() => {});
		}

		return records.map((r) => this.toEntry(r));
	}

	// ─── Focused Recall (for a specific entity/contact context) ───

	async recallFocused(params: {
		organizationId: string;
		contactEmail?: string;
		entityId?: string;
		limit?: number;
	}): Promise<MemoryEntry[]> {
		const entries: MemoryEntry[] = [];
		const limit = params.limit ?? 15;

		if (params.contactEmail) {
			const contactMemories = await this.recall({
				organizationId: params.organizationId,
				categories: [
					MEMORY_CATEGORIES.contact_profile,
					MEMORY_CATEGORIES.classification_learning,
				],
				scope: { type: MEMORY_SCOPES.contact, id: params.contactEmail },
				limit: Math.ceil(limit / 2),
			});
			entries.push(...contactMemories);
		}

		if (params.entityId) {
			const projectMemories = await this.recall({
				organizationId: params.organizationId,
				categories: [
					MEMORY_CATEGORIES.project_context,
					MEMORY_CATEGORIES.decision_record,
				],
				scope: { type: MEMORY_SCOPES.project, id: params.entityId },
				limit: Math.ceil(limit / 2),
			});
			entries.push(...projectMemories);
		}

		const seen = new Set(entries.map((e) => e.id));
		const remaining = limit - entries.length;
		if (remaining > 0) {
			const globalMemories = await this.recall({
				organizationId: params.organizationId,
				categories: [
					MEMORY_CATEGORIES.user_preference,
					MEMORY_CATEGORIES.behavior_pattern,
					MEMORY_CATEGORIES.org_insight,
				],
				limit: remaining,
			});
			for (const m of globalMemories) {
				if (!seen.has(m.id)) {
					entries.push(m);
				}
			}
		}

		return entries;
	}

	// ─── Specialized Write Methods ───

	async recordClassification(params: RecordClassificationParams): Promise<void> {
		const content = params.userCorrected
			? `用户将来自 ${params.sender} 的邮件 "${params.emailSubject}" 从 ${params.classification} 修正为 ${params.correctedTo}`
			: `来自 ${params.sender} 的邮件 "${params.emailSubject}" 被分类为 ${params.classification}（置信度: ${Math.round(params.confidence * 100)}%）`;

		await this.write({
			organizationId: params.organizationId,
			category: MEMORY_CATEGORIES.classification_learning,
			scope: MEMORY_SCOPES.contact,
			scopeId: params.sender,
			content,
			metadata: {
				sender: params.sender,
				subject: params.emailSubject,
				classification: params.classification,
				confidence: params.confidence,
				userCorrected: params.userCorrected ?? false,
				correctedTo: params.correctedTo,
			},
			importance: params.userCorrected ? 8 : 4,
		});
	}

	async recordContactProfile(params: RecordContactProfileParams): Promise<void> {
		await this.write({
			organizationId: params.organizationId,
			category: MEMORY_CATEGORIES.contact_profile,
			scope: MEMORY_SCOPES.contact,
			scopeId: params.contactEmail,
			content: params.content,
			metadata: {
				...params.metadata,
				contactEmail: params.contactEmail,
			},
			importance: params.importance ?? 6,
		});
	}

	async recordDecision(params: RecordDecisionParams): Promise<void> {
		const importance = params.userApproved === false ? 8 : 5;
		let content = params.decision;
		if (params.userCorrection) {
			content = `${params.decision} → 用户修正: ${params.userCorrection}`;
		}

		await this.write({
			organizationId: params.organizationId,
			category: MEMORY_CATEGORIES.decision_record,
			scope: MEMORY_SCOPES.project,
			scopeId: params.entityId,
			content,
			metadata: {
				entityId: params.entityId,
				userApproved: params.userApproved,
				userCorrection: params.userCorrection,
				...params.metadata,
			},
			importance,
		});
	}

	async recordInsight(params: RecordInsightParams): Promise<void> {
		await this.write({
			organizationId: params.organizationId,
			category: params.category,
			scope: params.scope,
			scopeId: params.scopeId,
			content: params.content,
			metadata: params.metadata,
			importance: params.importance,
			origin: params.origin,
		});
	}

	// ─── 四分类写入（Claude Code 风格） ───

	/**
	 * 记录用户画像信息（角色、专业度、偏好风格）
	 * 对应 Claude Code memory type: user
	 */
	async recordUserProfile(params: RecordUserProfileParams): Promise<void> {
		await this.write({
			organizationId: params.organizationId,
			category: MEMORY_CATEGORIES.user_preference,
			scope: MEMORY_SCOPES.user,
			scopeId: params.userId,
			content: params.content,
			metadata: { userId: params.userId, ...params.metadata },
			importance: 7,
			origin: "observation",
		});
	}

	/**
	 * 记录操作反馈——纠正或确认
	 * 对应 Claude Code memory type: feedback
	 * 只记纠正会让 Agent 过于保守；确认也要记，以强化已验证的方向
	 */
	async recordFeedback(params: RecordFeedbackParams): Promise<void> {
		const prefix = params.origin === "correction" ? "【纠正】" : "【确认】";
		const reasonSuffix = params.reason ? `\n原因：${params.reason}` : "";
		const content = `${prefix}${params.content}${reasonSuffix}`;

		// 纠正比确认重要性更高（需要更强地影响未来行为）
		const importance = params.origin === "correction" ? 9 : 7;

		await this.write({
			organizationId: params.organizationId,
			category: MEMORY_CATEGORIES.behavior_pattern,
			scope: params.scope ?? MEMORY_SCOPES.org,
			scopeId: params.scopeId,
			content,
			metadata: {
				origin: params.origin,
				reason: params.reason,
				...params.metadata,
			},
			importance,
			origin: params.origin,
		});
	}

	/**
	 * 记录业务背景（进展、截止日期、决策动机）
	 * 对应 Claude Code memory type: project
	 * 包含"为什么"，帮助 Agent 判断记忆是否仍然有效
	 */
	async recordProjectContext(params: RecordProjectContextParams): Promise<void> {
		const reasonSuffix = params.reason ? `\n背景：${params.reason}` : "";
		const content = `${params.content}${reasonSuffix}`;

		await this.write({
			organizationId: params.organizationId,
			category: MEMORY_CATEGORIES.project_context,
			scope: params.entityId ? MEMORY_SCOPES.project : MEMORY_SCOPES.org,
			scopeId: params.entityId,
			content,
			metadata: { entityId: params.entityId, ...params.metadata },
			importance: 6,
			expiresAt: params.expiresAt,
			origin: "observation",
		});
	}

	/**
	 * 记录外部资源指针（联系人角色、邮件习惯、外部系统位置）
	 * 对应 Claude Code memory type: reference
	 */
	async recordReference(params: RecordReferenceParams): Promise<void> {
		await this.write({
			organizationId: params.organizationId,
			category: MEMORY_CATEGORIES.contact_profile,
			scope: params.contactEmail ? MEMORY_SCOPES.contact : MEMORY_SCOPES.org,
			scopeId: params.contactEmail,
			content: params.content,
			metadata: {
				contactEmail: params.contactEmail,
				...params.metadata,
			},
			importance: 6,
			origin: "observation",
		});
	}

	// ─── Legacy-compatible methods (used by classifier's MemoryRecaller) ───

	async recallBySender(
		organizationId: string,
		sender: string,
		limit = 5,
	): Promise<MemoryEntry[]> {
		return this.recall({
			organizationId,
			categories: [MEMORY_CATEGORIES.classification_learning],
			scope: { type: MEMORY_SCOPES.contact, id: sender },
			limit,
		});
	}

	async getRecentInsights(
		organizationId: string,
		limit = 5,
	): Promise<MemoryEntry[]> {
		return this.recall({
			organizationId,
			limit,
			minImportance: 3,
		});
	}

	// ─── Importance Decay ───

	async applyDecay(organizationId: string): Promise<number> {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - DECAY_THRESHOLD_DAYS);

		const stale = await db.agentMemory.findMany({
			where: {
				organizationId,
				importance: { gt: MIN_IMPORTANCE },
				lastAccessedAt: { lt: cutoff },
				accessCount: { lt: 3 },
			},
			select: { id: true, importance: true },
		});

		if (stale.length === 0) {
			return 0;
		}

		let decayed = 0;
		for (const record of stale) {
			const newImportance = Math.max(MIN_IMPORTANCE, record.importance - 1);
			if (newImportance !== record.importance) {
				await db.agentMemory.update({
					where: { id: record.id },
					data: { importance: newImportance },
				});
				decayed++;
			}
		}

		return decayed;
	}

	// ─── Helpers ───

	private toEntry(r: {
		id: string;
		category: string;
		scope: string;
		scopeId: string | null;
		content: string;
		metadata: string | null;
		importance: number;
		createdAt: Date;
	}): MemoryEntry {
		const meta = r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : undefined;
		const origin = meta?.origin as MemoryOrigin | undefined;
		return {
			id: r.id,
			category: r.category as MemoryCategory,
			scope: r.scope as MemoryScope,
			scopeId: r.scopeId,
			content: r.content,
			metadata: meta,
			importance: r.importance,
			createdAt: r.createdAt,
			origin,
		};
	}
}
