import { expect, test } from "./fixtures";

test.describe("user feedback and memory", () => {
	async function getFirstEntityId(
		request: import("@playwright/test").APIRequestContext,
		orgId: string,
	) {
		const listRes = await request.post(
			"http://localhost:3000/api/rpc/flowEntities.list",
			{
				data: {
					json: {
						organizationId: orgId,
						limit: 1,
						offset: 0,
					},
				},
				headers: { Origin: "http://localhost:3000" },
			},
		);

		if (!listRes.ok()) {
			return null;
		}
		const data = await listRes.json();
		const entities = data?.json?.entities ?? data?.entities ?? [];
		return entities[0]?.id ?? null;
	}

	test("thumbs up feedback records decision_record", async ({
		orgId,
		request,
	}) => {
		test.skip(!orgId, "No org ID available");

		const entityId = await getFirstEntityId(request, orgId);
		test.skip(!entityId, "No entity available");
		if (!entityId) {
			return;
		}

		const feedbackRes = await request.post(
			"http://localhost:3000/api/rpc/flowEntities.submitFeedback",
			{
				data: {
					json: {
						entityId,
						feedbackType: "thumbs_up",
						target: "classification",
						comment: "E2E test - classification is correct",
					},
				},
				headers: { Origin: "http://localhost:3000" },
			},
		);

		expect(feedbackRes.ok()).toBeTruthy();
		const result = await feedbackRes.json();
		const body = result?.json ?? result;
		expect(body.recorded).toBe(true);
	});

	test("thumbs down with correction records classification_learning", async ({
		orgId,
		request,
	}) => {
		test.skip(!orgId, "No org ID available");

		const entityId = await getFirstEntityId(request, orgId);
		test.skip(!entityId, "No entity available");
		if (!entityId) {
			return;
		}

		const feedbackRes = await request.post(
			"http://localhost:3000/api/rpc/flowEntities.submitFeedback",
			{
				data: {
					json: {
						entityId,
						feedbackType: "thumbs_down",
						target: "classification",
						correction: "REPORT",
						comment: "E2E test - should be a report not approval",
					},
				},
				headers: { Origin: "http://localhost:3000" },
			},
		);

		expect(feedbackRes.ok()).toBeTruthy();
		const result = await feedbackRes.json();
		const body = result?.json ?? result;
		expect(body.recorded).toBe(true);
	});

	test("feedback creates timeline event on entity", async ({
		orgId,
		request,
	}) => {
		test.skip(!orgId, "No org ID available");

		const entityId = await getFirstEntityId(request, orgId);
		test.skip(!entityId, "No entity available");
		if (!entityId) {
			return;
		}

		await request.post(
			"http://localhost:3000/api/rpc/flowEntities.submitFeedback",
			{
				data: {
					json: {
						entityId,
						feedbackType: "thumbs_up",
						target: "suggestion",
						comment: "E2E timeline verification",
					},
				},
				headers: { Origin: "http://localhost:3000" },
			},
		);

		const getRes = await request.post(
			"http://localhost:3000/api/rpc/flowEntities.get",
			{
				data: { json: { entityId } },
				headers: { Origin: "http://localhost:3000" },
			},
		);

		expect(getRes.ok()).toBeTruthy();
		const entityData = await getRes.json();
		const entity = entityData?.json ?? entityData;
		const timeline: Array<{
			type: string;
			content: string;
			metadata?: string;
		}> = entity.timeline ?? [];

		const feedbackEvents = timeline.filter(
			(e) => e.type === "action_taken" && e.content.includes("用户反馈"),
		);
		expect(feedbackEvents.length).toBeGreaterThan(0);

		const latestFeedback = feedbackEvents[feedbackEvents.length - 1];
		expect(latestFeedback.content).toContain("👍");
	});

	test("feedback API rejects invalid target", async ({ orgId, request }) => {
		test.skip(!orgId, "No org ID available");

		const entityId = await getFirstEntityId(request, orgId);
		test.skip(!entityId, "No entity available");
		if (!entityId) {
			return;
		}

		const res = await request.post(
			"http://localhost:3000/api/rpc/flowEntities.submitFeedback",
			{
				data: {
					json: {
						entityId,
						feedbackType: "thumbs_up",
						target: "invalid_target",
					},
				},
				headers: { Origin: "http://localhost:3000" },
			},
		);

		expect(res.ok()).toBeFalsy();
	});

	test("feedback API rejects unauthenticated request", async ({
		browser,
	}) => {
		const context = await browser.newContext({ storageState: undefined });
		const page = await context.newPage();

		const res = await page.request.post(
			"http://localhost:3000/api/rpc/flowEntities.submitFeedback",
			{
				data: {
					json: {
						entityId: "fake-id",
						feedbackType: "thumbs_up",
						target: "classification",
					},
				},
			},
		);

		expect(res.status()).toBeGreaterThanOrEqual(400);
		await context.close();
	});
});
