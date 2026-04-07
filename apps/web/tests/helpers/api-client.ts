import type { APIRequestContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const HEADERS = { Origin: BASE };

export class FlowmailApiClient {
	constructor(private request: APIRequestContext) {}

	async signUp(email: string, password: string, name: string) {
		return this.request.post(`${BASE}/api/auth/sign-up/email`, {
			data: { email, password, name },
			headers: HEADERS,
		});
	}

	async signIn(email: string, password: string) {
		return this.request.post(`${BASE}/api/auth/sign-in/email`, {
			data: { email, password },
			headers: HEADERS,
		});
	}

	async getSession() {
		const res = await this.request.get(`${BASE}/api/auth/get-session`, {
			headers: HEADERS,
		});
		if (!res.ok()) {
			return null;
		}
		return res.json();
	}

	async createOrganization(name: string, slug: string) {
		return this.request.post(`${BASE}/api/auth/organization/create`, {
			data: { name, slug },
			headers: HEADERS,
		});
	}

	async setActiveOrganization(organizationId: string) {
		return this.request.post(`${BASE}/api/auth/organization/set-active`, {
			data: { organizationId },
			headers: HEADERS,
		});
	}

	async listEntities(organizationId: string) {
		return this.request.post(`${BASE}/api/rpc/flowEntities.list`, {
			data: { json: { organizationId } },
		});
	}

	async getEntity(entityId: string) {
		return this.request.post(`${BASE}/api/rpc/flowEntities.get`, {
			data: { json: { entityId } },
		});
	}

	async approveEntity(entityId: string, comment?: string) {
		return this.request.post(`${BASE}/api/rpc/approvals.approve`, {
			data: { json: { entityId, comment } },
		});
	}

	async rejectEntity(entityId: string, comment?: string) {
		return this.request.post(`${BASE}/api/rpc/approvals.reject`, {
			data: { json: { entityId, comment } },
		});
	}

	async submitFeedback(params: {
		entityId: string;
		feedbackType: "thumbs_up" | "thumbs_down";
		target: "classification" | "suggestion" | "agent_action";
		correction?: string;
		comment?: string;
	}) {
		return this.request.post(
			`${BASE}/api/rpc/flowEntities.submitFeedback`,
			{ data: { json: params } },
		);
	}

	async agentChat(
		messages: Array<{ role: string; content: string }>,
		pageContext?: Record<string, unknown>,
	) {
		const uiMessages = messages.map((m, i) => ({
			id: `msg_${i}`,
			role: m.role,
			parts: [{ type: "text", text: m.content }],
		}));
		return this.request.post(`${BASE}/api/agent/chat`, {
			data: { messages: uiMessages, pageContext },
		});
	}
}
