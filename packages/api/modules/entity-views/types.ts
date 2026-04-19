import { z } from "zod";
import { ViewSpecSchema } from "@repo/agent";

export {
	ViewSpecSchema,
	ViewBlockSchema,
	VIEW_COMPONENT_DOCS,
	type ViewBlock,
	type ViewSpec,
	type SummaryBlock,
	type KpiCardsBlock,
	type TodoListBlock,
	type TimelineBlock,
	type TableBlock,
	type QuickActionsBlock,
} from "@repo/agent";

// ─── Procedure inputs ───────────────────────────────────────

export const listEntityViewsSchema = z.object({
	entityId: z.string().optional(),
	categoryId: z.string().optional(),
	organizationId: z.string().optional(),
});

export const getEntityViewSchema = z.object({
	viewId: z.string(),
});

export const createEntityViewSchema = z
	.object({
		title: z.string().min(1).max(60),
		icon: z.string().optional(),
		spec: ViewSpecSchema,
		entityId: z.string().optional(),
		categoryId: z.string().optional(),
		organizationId: z.string().optional(),
		isPinned: z.boolean().optional(),
	})
	.refine((v) => !!v.entityId || !!v.categoryId, {
		message: "必须提供 entityId 或 categoryId",
	});

export const updateEntityViewSchema = z.object({
	viewId: z.string(),
	title: z.string().min(1).max(60).optional(),
	icon: z.string().optional(),
	spec: ViewSpecSchema.optional(),
	isPinned: z.boolean().optional(),
	sortOrder: z.number().optional(),
});

export const deleteEntityViewSchema = z.object({
	viewId: z.string(),
});

