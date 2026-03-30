import { generateText, textModel } from "@repo/ai";

export async function summarizeThread(threadContent: string): Promise<string> {
	const { text } = await generateText({
		model: textModel,
		prompt: `You are an enterprise email assistant. Summarize this email thread concisely.

Requirements:
1. Max 150 characters
2. Focus on: current status, key decisions, action items
3. Use the same language as the email (Chinese or English)
4. Don't repeat email text verbatim, extract key info

Email thread (chronological order):
${threadContent}`,
	});

	return text;
}
