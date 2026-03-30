import type { PageContext } from "./types";

/**
 * 从当前页面状态构建标准上下文包。
 * 这个上下文会随每次消息发送到后端，注入 system prompt，
 * 让 Agent 理解用户当前看到的是什么。
 */
export function buildPageContext(params: {
	route: string;
	organizationId?: string;
	entity?: {
		id: string;
		title: string;
		type: string;
		status: string;
		aiSummary?: string | null;
		extractedFields?: string | null;
		aiConfidence?: number | null;
		timeline?: Array<{
			type: string;
			content: string;
			createdAt: Date | string;
		}>;
	} | null;
	activeFilters?: {
		type?: string;
		status?: string;
		search?: string;
	};
}): PageContext {
	const { route, organizationId, entity, activeFilters } = params;

	const ctx: PageContext = { route };

	if (organizationId) {
		ctx.organizationId = organizationId;
	}

	if (entity) {
		ctx.entityId = entity.id;

		let extractedFields: Record<string, unknown> = {};
		if (entity.extractedFields) {
			try {
				extractedFields = JSON.parse(entity.extractedFields) as Record<string, unknown>;
			} catch {
				// ignore
			}
		}

		ctx.entity = {
			id: entity.id,
			title: entity.title,
			type: entity.type,
			status: entity.status,
			aiSummary: entity.aiSummary,
			extractedFields,
			aiConfidence: entity.aiConfidence,
		};

		if (entity.timeline && entity.timeline.length > 0) {
			ctx.timelinePreview = entity.timeline.slice(-5).map((e) => ({
				type: e.type,
				content: e.content,
				createdAt: typeof e.createdAt === "string" ? e.createdAt : e.createdAt.toISOString(),
			}));
		}
	}

	if (activeFilters && Object.values(activeFilters).some(Boolean)) {
		ctx.activeFilters = activeFilters;
	}

	return ctx;
}
