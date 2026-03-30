import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { textModel, generateObject } from "@repo/ai";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

const predictRiskSchema = z.object({
	entityId: z.string(),
});

const riskPredictionSchema = z.object({
	riskLevel: z.enum(["low", "medium", "high", "critical"]),
	riskFactors: z.array(z.string()),
	predictedOutcome: z.string(),
	suggestedActions: z.array(z.string()),
	deadlineRisk: z.object({
		hasDeadline: z.boolean(),
		deadline: z.string().nullable(),
		daysRemaining: z.number().nullable(),
		isAtRisk: z.boolean(),
	}),
	confidence: z.number().min(0).max(1),
});

export const predictEntityRisk = protectedProcedure
	.route({
		method: "GET",
		path: "/flow-entities/{entityId}/predict-risk",
		tags: ["FlowEntities"],
		summary: "AI prediction of entity risk and outcome",
	})
	.input(predictRiskSchema)
	.handler(async ({ input }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
			include: {
				timeline: {
					orderBy: { createdAt: "asc" },
				},
			},
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND");
		}

		const hasAiKey = !!process.env.OPENAI_API_KEY;

		if (!hasAiKey) {
			return {
				riskLevel: "low" as const,
				riskFactors: [],
				predictedOutcome: "AI prediction requires OPENAI_API_KEY",
				suggestedActions: [],
				deadlineRisk: {
					hasDeadline: false,
					deadline: null,
					daysRemaining: null,
					isAtRisk: false,
				},
				confidence: 0,
			};
		}

		const fields = entity.extractedFields ? JSON.parse(entity.extractedFields) : {};
		const timelineText = entity.timeline
			.map((e) => `[${e.createdAt.toISOString()}] ${e.type}: ${e.content}`)
			.join("\n");

		const today = new Date().toISOString().split("T")[0];

		const { object: prediction } = await generateObject({
			model: textModel,
			schema: riskPredictionSchema,
			prompt: `You are a business risk analyst. Analyze this entity and predict risk.

Entity: "${entity.title}"
Type: ${entity.type}
Status: ${entity.status}
Created: ${entity.createdAt.toISOString()}
Today: ${today}

Extracted fields:
${JSON.stringify(fields, null, 2)}

Timeline:
${timelineText || "(no timeline events yet)"}

Assess:
1. Risk level (low/medium/high/critical)
2. Key risk factors
3. Predicted outcome if no action taken
4. Suggested actions
5. Deadline risk (extract deadline from fields if present)
6. Your confidence (0-1)

Be practical and concise.`,
		});

		return prediction;
	});
