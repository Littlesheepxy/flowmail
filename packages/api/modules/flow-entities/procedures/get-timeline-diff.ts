import { ORPCError } from "@orpc/client";
import { generateText, Output, textModel } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";

const getTimelineDiffSchema = z.object({
	entityId: z.string(),
	fromEventId: z
		.string()
		.optional()
		.describe("Start event ID for diff range"),
	toEventId: z.string().optional().describe("End event ID for diff range"),
});

const diffResultSchema = z.object({
	summary: z.string().describe("Human-readable summary of changes"),
	changes: z.array(
		z.object({
			field: z.string(),
			before: z.string().nullable(),
			after: z.string().nullable(),
			significance: z.enum(["low", "medium", "high", "critical"]),
		}),
	),
	riskSignals: z
		.array(z.string())
		.describe("Risk signals detected between versions"),
	progressDelta: z
		.number()
		.min(-100)
		.max(100)
		.nullable()
		.describe("Progress change as percentage, null if not applicable"),
	recommendation: z
		.string()
		.nullable()
		.describe("AI recommendation based on changes"),
});

export const getTimelineDiff = protectedProcedure
	.route({
		method: "GET",
		path: "/flow-entities/{entityId}/timeline/diff",
		tags: ["FlowEntities"],
		summary: "Get semantic diff between two timeline points",
	})
	.input(getTimelineDiffSchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
			select: { id: true, type: true, title: true, organizationId: true },
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(
			entity.organizationId,
			context.user.id,
		);

		const allEvents = await db.timelineEvent.findMany({
			where: { entityId: input.entityId },
			orderBy: { createdAt: "asc" },
		});

		if (allEvents.length < 2) {
			return {
				summary: "Not enough timeline events to generate a diff",
				changes: [],
				riskSignals: [],
				progressDelta: null,
				recommendation: null,
				fromEvent: null,
				toEvent: null,
			};
		}

		const fromIdx = input.fromEventId
			? allEvents.findIndex((e) => e.id === input.fromEventId)
			: 0;
		const toIdx = input.toEventId
			? allEvents.findIndex((e) => e.id === input.toEventId)
			: allEvents.length - 1;

		const fromEvent = allEvents[Math.max(0, fromIdx)];
		const toEvent = allEvents[Math.min(allEvents.length - 1, toIdx)];
		const rangeEvents = allEvents.slice(
			Math.max(0, fromIdx),
			Math.min(allEvents.length, toIdx + 1),
		);

		const hasAiKey = !!process.env.OPENAI_API_KEY;

		if (!hasAiKey) {
			return {
				summary: `${rangeEvents.length} events between selected range`,
				changes: [],
				riskSignals: [],
				progressDelta: null,
				recommendation: null,
				fromEvent,
				toEvent,
				events: rangeEvents,
			};
		}

		const eventsText = rangeEvents
			.map(
				(e) => `[${e.createdAt.toISOString()}] ${e.type}: ${e.content}`,
			)
			.join("\n");

		const { output: diff } = await generateText({
			model: textModel,
			output: Output.object({ schema: diffResultSchema }),
			prompt: `You are analyzing timeline events for a business entity.

Entity: "${entity.title}" (type: ${entity.type})

Timeline events in this range:
${eventsText}

Analyze these events and produce a semantic diff showing:
1. What changed (key fields, status, progress)  
2. Risk signals (delays, blockers, escalations)
3. Progress delta (if applicable, as a percentage -100 to 100)
4. A brief recommendation

Be concise and business-focused. Focus on what matters to a business stakeholder.`,
		});

		return {
			...diff,
			fromEvent,
			toEvent,
			events: rangeEvents,
		};
	});
