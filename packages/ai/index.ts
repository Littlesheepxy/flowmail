import { createOpenAI } from "@ai-sdk/openai";

const gatewayBaseURL = process.env.AI_GATEWAY_BASE_URL;
const gatewayApiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY;

if (!gatewayBaseURL || !gatewayApiKey) {
	console.warn(
		"[AI] Missing AI_GATEWAY_BASE_URL or AI_GATEWAY_API_KEY / OPENAI_API_KEY. AI features will fail at runtime.",
	);
}

const gatewayModel = process.env.AI_GATEWAY_MODEL || "gpt-4o-mini";

const gateway = createOpenAI({
	baseURL: gatewayBaseURL ?? "https://api.openai.com/v1",
	apiKey: gatewayApiKey ?? "",
});

export const textModel = gateway.chat(gatewayModel);
export const fastModel = gateway.chat(gatewayModel);

export * from "ai";
export * from "./lib";
