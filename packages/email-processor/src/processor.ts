import { db } from "@repo/database";
import { classifyEmail } from "./classifier";
import { extractApprovalFields, extractReportFields } from "./extractor";
import { summarizeThread } from "./summarizer";

interface EmailInput {
	threadId: string;
	subject: string;
	sender: string;
	senderEmail: string;
	content: string;
	organizationId: string;
	connectionId: string;
	externalThreadId: string;
	receivedAt: Date;
}

interface ProcessResult {
	success: boolean;
	entityId?: string;
	classification?: string;
	error?: string;
	requiresManualReview: boolean;
}

export async function processEmail(input: EmailInput): Promise<ProcessResult> {
	try {
		const classification = await classifyEmail({
			subject: input.subject,
			sender: input.sender,
			content: input.content,
		});

		if (classification.type === "UNKNOWN") {
			return {
				success: true,
				classification: "UNKNOWN",
				requiresManualReview: true,
			};
		}

		const requiresReview = classification.confidence < 0.7;

		let extractedFields: Record<string, unknown> = {};
		if (classification.type === "APPROVAL") {
			extractedFields = await extractApprovalFields(input.content);
		} else if (classification.type === "REPORT") {
			extractedFields = await extractReportFields(input.content);
		}

		const summary = await summarizeThread(input.content);

		const initialStatus = determineInitialStatus(classification.type, extractedFields);

		const entity = await db.flowEntity.create({
			data: {
				organizationId: input.organizationId,
				type: classification.type as "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK",
				title: (extractedFields as { title?: string }).title ?? input.subject,
				status: initialStatus,
				extractedFields: JSON.stringify(extractedFields),
				aiSummary: summary,
				aiConfidence: classification.confidence,
				requiresReview,
			},
		});

		await db.emailThread.create({
			data: {
				organizationId: input.organizationId,
				connectionId: input.connectionId,
				externalThreadId: input.externalThreadId,
				subject: input.subject,
				sender: input.senderEmail,
				participants: JSON.stringify([input.senderEmail]),
				snippet: input.content.slice(0, 200),
				entityId: entity.id,
				receivedAt: input.receivedAt,
				processedAt: new Date(),
			},
		});

		await db.timelineEvent.create({
			data: {
				entityId: entity.id,
				type: "email_received",
				content: `Email received from ${input.sender}: ${input.subject}`,
				metadata: JSON.stringify({
					sender: input.senderEmail,
					subject: input.subject,
				}),
			},
		});

		await db.timelineEvent.create({
			data: {
				entityId: entity.id,
				type: "ai_summary",
				content: `AI classified as ${classification.type} (${Math.round(classification.confidence * 100)}% confidence): ${summary}`,
				metadata: JSON.stringify({
					classification,
					extractedFields,
				}),
			},
		});

		return {
			success: true,
			entityId: entity.id,
			classification: classification.type,
			requiresManualReview: requiresReview,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
			requiresManualReview: true,
		};
	}
}

function determineInitialStatus(
	type: string,
	extractedFields: Record<string, unknown>,
): string {
	switch (type) {
		case "APPROVAL":
			return "pending";
		case "REPORT": {
			const overallStatus = (extractedFields as { overallStatus?: string }).overallStatus;
			if (overallStatus === "blocked") return "blocked";
			return "in_progress";
		}
		case "ISSUE":
			return "open";
		case "FEEDBACK":
			return "received";
		default:
			return "pending";
	}
}
