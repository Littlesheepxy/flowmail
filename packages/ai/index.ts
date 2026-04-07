import { createOpenAI } from "@ai-sdk/openai";

const gatewayBaseURL = process.env.AI_GATEWAY_BASE_URL;
const gatewayApiKey =
	process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY;

if (!gatewayBaseURL || !gatewayApiKey) {
	console.warn(
		"[AI] Missing AI_GATEWAY_BASE_URL or AI_GATEWAY_API_KEY / OPENAI_API_KEY. AI features will fail at runtime.",
	);
}

const gateway = createOpenAI({
	baseURL: gatewayBaseURL ?? "https://api.openai.com/v1",
	apiKey: gatewayApiKey ?? "",
});

const gatewayModel = process.env.AI_GATEWAY_MODEL;
const fastModelName =
	process.env.AI_FAST_MODEL || gatewayModel || "gpt-4o-mini";
const textModelName = process.env.AI_TEXT_MODEL || gatewayModel || "gpt-4o";
const reasoningModelName =
	process.env.AI_REASONING_MODEL || gatewayModel || "o3-mini";

export const fastModel = gateway.chat(fastModelName);
export const textModel = gateway.chat(textModelName);
export const reasoningModel = gateway.chat(reasoningModelName);

export * from "ai";
export * from "./lib";
