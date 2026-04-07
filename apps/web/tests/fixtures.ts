import fs from "node:fs";
import path from "node:path";
import { test as base, expect } from "@playwright/test";
import { FlowmailApiClient } from "./helpers/api-client";

const ORG_SLUG = "e2e-org";
const CONTEXT_FILE = path.resolve(__dirname, ".auth/context.json");

function loadTestContext(): {
	orgId: string;
	orgSlug: string;
	userId: string;
} | null {
	try {
		if (fs.existsSync(CONTEXT_FILE)) {
			return JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf-8"));
		}
	} catch {
		// ignore
	}
	return null;
}

interface FlowmailFixtures {
	orgSlug: string;
	orgId: string;
	api: FlowmailApiClient;
}

export const test = base.extend<FlowmailFixtures>({
	orgSlug: ORG_SLUG,

	orgId: async ({ orgSlug: _slug }, use) => {
		const ctx = loadTestContext();
		await use(ctx?.orgId ?? "");
	},

	api: async ({ request }, use) => {
		const api = new FlowmailApiClient(request);
		await use(api);
	},
});

export { expect };
