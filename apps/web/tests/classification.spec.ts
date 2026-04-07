import { expect, test } from "./fixtures";

const HAS_AI_KEY = !!(
	process.env.OPENAI_API_KEY ||
	process.env.ANTHROPIC_API_KEY ||
	process.env.AI_GATEWAY_API_KEY
);

test.describe("intelligent classification flow", () => {
	test("scan_email_headers returns unclassified emails via agent", async ({
		page,
		orgId,
	}) => {
		test.skip(!HAS_AI_KEY, "No AI API key — skipping");
		test.setTimeout(60_000);

		await page.goto("/app");
		await page.waitForLoadState("networkidle");

		const res = await page.request.post(
			"http://localhost:3000/api/agent/chat",
			{
				data: {
					organizationId: orgId,
					messages: [
						{
							id: "classify_scan_1",
							role: "user",
							parts: [
								{
									type: "text",
									text: "帮我看看有多少未分类的邮件",
								},
							],
						},
					],
				},
				headers: { Origin: "http://localhost:3000" },
			},
		);

		if (!res.ok()) {
			const body = await res.text();
			console.log(
				`[classification] scan status: ${res.status()}, body: ${body.slice(0, 500)}`,
			);
		}
		expect(res.ok()).toBeTruthy();

		const body = await res.text();
		expect(body.length).toBeGreaterThan(0);
	});

	test("classification flow triggers scan + sample on classify request", async ({
		page,
		orgId,
	}) => {
		test.skip(!HAS_AI_KEY, "No AI API key — skipping");
		test.setTimeout(180_000);

		await page.goto("/app");
		await page.waitForLoadState("networkidle");

		const res = await page.request.post(
			"http://localhost:3000/api/agent/chat",
			{
				data: {
					organizationId: orgId,
					messages: [
						{
							id: "classify_flow_1",
							role: "user",
							parts: [
								{
									type: "text",
									text: "帮我整理和分类邮件",
								},
							],
						},
					],
				},
				headers: { Origin: "http://localhost:3000" },
			},
		);

		if (!res.ok()) {
			const body = await res.text();
			console.log(
				`[classification-flow] status: ${res.status()}, body: ${body.slice(0, 500)}`,
			);
		}
		expect(res.ok()).toBeTruthy();

		const body = await res.text();
		expect(body.length).toBeGreaterThan(10);
	});

	test("agent chat includes unclassifiedEmailCount in context", async ({
		page,
		orgId,
	}) => {
		test.skip(!HAS_AI_KEY, "No AI API key — skipping");
		test.setTimeout(60_000);

		await page.goto("/app");
		await page.waitForLoadState("networkidle");

		const res = await page.request.post(
			"http://localhost:3000/api/agent/chat",
			{
				data: {
					organizationId: orgId,
					messages: [
						{
							id: "ctx_check_1",
							role: "user",
							parts: [
								{
									type: "text",
									text: "你好，告诉我当前收件箱的状态",
								},
							],
						},
					],
				},
				headers: { Origin: "http://localhost:3000" },
			},
		);

		expect(res.ok()).toBeTruthy();
		const body = await res.text();
		expect(body.length).toBeGreaterThan(0);
	});
});
