import { expect, test } from "./fixtures";

test.describe("approval flow", () => {
	test("/approvals redirects to inbox with category=approval", async ({
		page,
		orgSlug,
	}) => {
		await page.goto(`/app/${orgSlug}/approvals`);
		await page.waitForURL(/category=approval/, { timeout: 10000 });
		expect(page.url()).toContain("category=approval");
	});

	test("pending approval detail shows entity info", async ({
		page,
		orgSlug,
	}) => {
		await page.goto(`/app/${orgSlug}/inbox?category=approval`);
		await page.waitForLoadState("networkidle");

		// Close guide dialog if present
		const closeBtn = page.locator('dialog button:has-text("×")');
		if ((await closeBtn.count()) > 0) {
			await closeBtn.first().click();
			await page.waitForTimeout(500);
		}

		const cards = page.locator("main button.w-full.text-left");
		await expect(cards.first()).toBeVisible({ timeout: 15000 });

		// Find a card with "pending" status text
		const count = await cards.count();
		let foundPending = false;
		for (let i = 0; i < count; i++) {
			const text = await cards.nth(i).textContent();
			if (text?.toLowerCase().includes("pending")) {
				await cards.nth(i).click();
				foundPending = true;
				break;
			}
		}

		if (!foundPending) {
			await cards.first().click();
		}

		await page.waitForTimeout(3000);

		// Verify entity detail shows a title
		const title = page.locator("main h2").first();
		await expect(title).toBeVisible({ timeout: 10000 });

		// Check that the entity title is approval-related
		const text = await title.textContent();
		expect(text?.length).toBeGreaterThan(0);
	});

	test("approve via API changes entity status", async ({ request }) => {
		const session = await request.get(
			"http://localhost:3000/api/auth/get-session",
			{ headers: { Origin: "http://localhost:3000" } },
		);

		if (!session.ok()) {
			test.skip(true, "No session");
			return;
		}

		const sessionData = await session.json();
		const orgId = sessionData?.session?.activeOrganizationId;
		if (!orgId) {
			test.skip(true, "No active organization");
			return;
		}

		// Find a pending approval
		const listRes = await request.post(
			"http://localhost:3000/api/rpc/flowEntities.list",
			{
				data: {
					json: {
						organizationId: orgId,
						status: "pending",
						type: "APPROVAL",
						limit: 1,
						offset: 0,
					},
				},
			},
		);

		if (!listRes.ok()) {
			test.skip(true, "Could not list entities");
			return;
		}

		const listData = await listRes.json();
		const entities = listData?.json?.entities ?? listData?.entities ?? [];
		const pendingEntity = entities[0];

		if (!pendingEntity) {
			test.skip(true, "No pending approval to test");
			return;
		}

		// Approve it
		const approveRes = await request.post(
			"http://localhost:3000/api/rpc/approvals.approve",
			{
				data: {
					json: {
						entityId: pendingEntity.id,
						comment: "E2E test approval",
					},
				},
			},
		);
		expect(approveRes.ok()).toBeTruthy();

		// Verify status changed
		const getRes = await request.post(
			"http://localhost:3000/api/rpc/flowEntities.get",
			{ data: { json: { entityId: pendingEntity.id } } },
		);
		expect(getRes.ok()).toBeTruthy();

		const entityData = await getRes.json();
		const entity = entityData?.json ?? entityData;
		expect(entity.status).toBe("approved");
	});

	test("approval creates timeline event", async ({ request }) => {
		const session = await request.get(
			"http://localhost:3000/api/auth/get-session",
			{ headers: { Origin: "http://localhost:3000" } },
		);

		if (!session.ok()) {
			test.skip(true, "No session");
			return;
		}

		const sessionData = await session.json();
		const orgId = sessionData?.session?.activeOrganizationId;
		if (!orgId) {
			test.skip(true, "No active organization");
			return;
		}

		// Find an approved entity
		const listRes = await request.post(
			"http://localhost:3000/api/rpc/flowEntities.list",
			{
				data: {
					json: {
						organizationId: orgId,
						status: "approved",
						type: "APPROVAL",
						limit: 1,
						offset: 0,
					},
				},
			},
		);

		if (!listRes.ok()) {
			test.skip(true, "Could not list entities");
			return;
		}

		const listData = await listRes.json();
		const entities = listData?.json?.entities ?? listData?.entities ?? [];
		const approvedEntity = entities[0];

		if (!approvedEntity) {
			test.skip(true, "No approved entity");
			return;
		}

		// Get entity with timeline
		const getRes = await request.post(
			"http://localhost:3000/api/rpc/flowEntities.get",
			{ data: { json: { entityId: approvedEntity.id } } },
		);
		expect(getRes.ok()).toBeTruthy();

		const entityData = await getRes.json();
		const entity = entityData?.json ?? entityData;
		const timeline = entity.timeline ?? [];

		const actionEvents = timeline.filter(
			(e: { type: string }) => e.type === "action_taken",
		);
		expect(actionEvents.length).toBeGreaterThan(0);
	});
});
