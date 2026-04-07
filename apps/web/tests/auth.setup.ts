/**
 * Playwright setup project — verifies the auth state created by global-setup.
 *
 * global-setup.ts creates the user, session, and storageState file directly
 * in the database, completely bypassing the API rate limiter.
 * This setup project just verifies the storageState file exists.
 */

import fs from "node:fs";
import { expect, test as setup } from "@playwright/test";

const AUTH_FILE = "tests/.auth/user.json";

setup("verify auth state", async () => {
	// global-setup.ts already created the auth file
	expect(
		fs.existsSync(AUTH_FILE),
		"Auth state file should exist (created by global-setup)",
	).toBeTruthy();

	const state = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
	expect(state.cookies.length).toBeGreaterThan(0);
	console.log(
		"[auth.setup] Auth state verified with",
		state.cookies.length,
		"cookies",
	);
});
