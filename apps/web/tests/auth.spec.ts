import { expect, test } from "./fixtures";

test.describe("authentication flow", () => {
	test.describe.configure({ mode: "serial" });

	test("unauthenticated user visiting /app is redirected to login", async ({
		browser,
	}) => {
		const context = await browser.newContext({ storageState: undefined });
		const page = await context.newPage();
		await page.goto("/app");
		await expect(page).toHaveURL(/\/auth\/login/);
		await context.close();
	});

	test("authenticated user can access /app", async ({ page }) => {
		await page.goto("/app");
		await page.waitForURL(/\/app/);
		const url = page.url();
		expect(url).toMatch(/\/app/);
		expect(url).not.toMatch(/\/auth\/login/);
	});

	test("authenticated user sees correct identity", async ({ page }) => {
		await page.goto("/app");
		await page.waitForLoadState("networkidle");

		expect(page.url()).not.toContain("/auth/login");

		// Verify user identity from page content (avoids flaky API calls)
		await expect(page.getByText("Welcome Test User!")).toBeVisible({
			timeout: 10_000,
		});
	});

	test("clearing session cookie redirects to login", async ({ browser }) => {
		const context = await browser.newContext({
			storageState: "tests/.auth/user.json",
		});
		const page = await context.newPage();

		await page.goto("/app");
		await page.waitForURL(/\/app/);
		expect(page.url()).not.toContain("/auth/login");

		await context.clearCookies();
		await page.goto("/app");
		await page.waitForTimeout(3000);

		const url = page.url();
		expect(url).toContain("/auth/login");
		await context.close();
	});
});
