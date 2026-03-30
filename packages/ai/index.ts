import { createOpenAI } from "@ai-sdk/openai";

const gatewayBaseURL =
	process.env.AI_GATEWAY_BASE_URL ?? "https://gateway.zerail.com/v1";
const gatewayApiKey =
	process.env.AI_GATEWAY_API_KEY ??
	process.env.OPENAI_API_KEY ??
	"";
const gatewayModel =
	process.env.AI_GATEWAY_MODEL ?? "Kimi-K2.5";

const gateway = createOpenAI({
	baseURL: gatewayBaseURL,
	apiKey: gatewayApiKey,
});

export const textModel = gateway(gatewayModel);
export const fastModel = gateway(gatewayModel);

export * from "ai";
export * from "./lib";
