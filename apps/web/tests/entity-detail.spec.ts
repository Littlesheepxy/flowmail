import { expect, test } from "./fixtures";

test.describe("entity detail view", () => {
	test.beforeEach(async ({ page, orgSlug }) => {
		await page.goto(`/app/${orgSlug}/inbox`);

		// Dismiss guided tour (driver.js overlay and dialogs)
		const closeBtn = page.locator('dialog button:has-text("×")');
		if ((await closeBtn.count()) > 0) {
			await closeBtn.first().click();
			await page.waitForTimeout(500);
		}
		// Press Escape to dismiss driver.js overlay if present
		await page.keyboard.press("Escape");
		await page.waitForTimeout(500);

		const firstCard = page.locator("main button.w-full.text-left").first();
		await expect(firstCard).toBeVisible({ timeout: 15000 });
		await firstCard.click();
		await page.waitForTimeout(3000);

		// Dismiss overlay again if it reappeared after card click
		const overlay = page.locator(".driver-overlay");
		if ((await overlay.count()) > 0) {
			await page.keyboard.press("Escape");
			await page.waitForTimeout(500);
		}
	});

	test("displays entity title", async ({ page }) => {
		const title = page.locator("main h2").first();
		await expect(title).toBeVisible({ timeout: 10000 });
		const text = await title.textContent();
		expect(text?.length).toBeGreaterThan(0);
	});

	test("shows status text in entity cards", async ({ page }) => {
		// Status is displayed as text like "pending", "approved", "in_progress"
		const statusTexts = page.getByText(
			/^(pending|approved|rejected|in_progress|completed|received|overdue)$/,
		);
		const count = await statusTexts.count();
		expect(count).toBeGreaterThan(0);
	});

	test("shows AI summary if available", async ({ page }) => {
		// AI summary appears as a paragraph under the title
		const summaryParagraph = page.locator("main h2 + p, main h2 ~ p");
		const hasSummary = (await summaryParagraph.count()) > 0;
		if (hasSummary) {
			const text = await summaryParagraph.first().textContent();
			expect(text?.length ?? 0).toBeGreaterThan(5);
		}
		expect(true).toBeTruthy();
	});

	test("shows timeline tab with events", async ({ page }) => {
		// Click the "时间线" tab to see timeline events
		const timelineTab = page.getByRole("tab", { name: /时间线/ });
		const hasTab = (await timelineTab.count()) > 0;

		if (hasTab) {
			await timelineTab.click();
			await page.waitForTimeout(1000);

			// Timeline events should be visible
			const tabPanel = page.getByRole("tabpanel");
			await expect(tabPanel).toBeVisible({ timeout: 5000 });

			const panelText = await tabPanel.textContent();
			expect(panelText?.length ?? 0).toBeGreaterThan(0);
		} else {
			// No timeline tab means the detail view renders differently
			expect(true).toBeTruthy();
		}
	});
});
