import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [["html"]],
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
		video: {
			mode: "retain-on-failure",
			size: { width: 640, height: 480 },
		},
	},
	projects: [
		{ name: "setup", testMatch: /.*\.setup\.ts/ },
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
			},
		},
	],
	webServer: {
		command: "pnpm --filter web run build && pnpm --filter web run start",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		stdout: "pipe",
		timeout: 180 * 1000,
	},
});
