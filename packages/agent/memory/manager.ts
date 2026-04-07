import { db } from "@repo/database";
import type {
	MemoryCategory,
	MemoryEntry,
	MemoryScope,
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
		try {
			const record = await db.agentMemory.create({
				data: {
					organizationId: params.organizationId,
					category: params.category,
					scope: params.scope ?? MEMORY_SCOPES.org,
					scopeId: params.scopeId,
					content: params.content,
					metadata: params.metadata
						? JSON.stringify(params.metadata)
						: undefined,
					importance: params.importance ?? 5,
					expiresAt: params.expiresAt,
				},
			});
			return record.id;
		} catch (e: unknown) {
			const code = (e as { code?: string })?.code;
			if (code === "P2021" || code === "P2010") {
				return "";
			}
			throw e;
		}
	}

	// ─── Multi-dimensional Recall ───

	async recall(options: RecallOptions): Promise<MemoryEntry[]> {
		try {
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
		} catch (e: unknown) {
			const code = (e as { code?: string })?.code;
			if (code === "P2021" || code === "P2010") {
				return [];
			}
			throw e;
		}
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

	async recordClassification(
		params: RecordClassificationParams,
	): Promise<void> {
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

	async recordContactProfile(
		params: RecordContactProfileParams,
	): Promise<void> {
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
		try {
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
				const newImportance = Math.max(
					MIN_IMPORTANCE,
					record.importance - 1,
				);
				if (newImportance !== record.importance) {
					await db.agentMemory.update({
						where: { id: record.id },
						data: { importance: newImportance },
					});
					decayed++;
				}
			}

			return decayed;
		} catch (e: unknown) {
			const code = (e as { code?: string })?.code;
			if (code === "P2021" || code === "P2010") {
				return 0;
			}
			throw e;
		}
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
		return {
			id: r.id,
			category: r.category as MemoryCategory,
			scope: r.scope as MemoryScope,
			scopeId: r.scopeId,
			content: r.content,
			metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
			importance: r.importance,
			createdAt: r.createdAt,
		};
	}
}
