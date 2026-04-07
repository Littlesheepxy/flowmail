import { expect, test } from "@playwright/test";
import { config } from "@/config";

test.describe("home page", () => {
	if (config.marketing.enabled) {
		test("should load", async ({ page }) => {
			test.setTimeout(120_000);
			await page.goto("/", {
				timeout: 90_000,
				waitUntil: "domcontentloaded",
			});

			const title = page.locator("h1").first();
			await expect(title).toBeVisible({ timeout: 30000 });
		});
	} else {
		test("should be redirected to app", async ({ page }) => {
			await page.goto("/");
			await expect(page).toHaveURL(/\.*\/auth\/login/);
		});
	}
});
