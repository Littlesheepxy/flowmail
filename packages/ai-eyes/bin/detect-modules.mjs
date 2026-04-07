#!/usr/bin/env node

/**
 * @ai-eyes/detect-modules
 *
 * Scans a React/Next.js project and suggests where to add `data-module` attributes.
 *
 * Usage:
 *   npx ai-eyes-detect [directory]
 *   node packages/ai-eyes/bin/detect-modules.mjs ./src
 *
 * What it does:
 * 1. Finds page/route components from app router or pages directory
 * 2. Identifies large feature components that export JSX
 * 3. Checks which files already have data-module
 * 4. Outputs a report with suggestions
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, basename, extname } from "node:path";

const TARGET_EXTENSIONS = new Set([".tsx", ".jsx"]);
const IGNORE_DIRS = new Set([
	"node_modules",
	".next",
	".git",
	"dist",
	"build",
	"coverage",
	"__tests__",
	"__mocks__",
]);

const PAGE_PATTERNS = [
	/^page\.[tj]sx?$/,
	/^layout\.[tj]sx?$/,
	/^default\.[tj]sx?$/,
];

const SENSITIVE_PATTERNS = [
	/type=["']password["']/i,
	/credit.?card/i,
	/<input[^>]*name=["'](?:cc|card|cvv|cvc|expiry)/i,
	/\bssn\b/i,
	/LoginForm|SignupForm|PasswordForm|AuthForm/,
	/ForgotPassword|ResetPassword/,
];

const rootDir = process.argv[2] || ".";

async function walk(dir) {
	const results = [];
	let entries;
	try {
		entries = await readdir(dir);
	} catch {
		return results;
	}

	for (const entry of entries) {
		if (IGNORE_DIRS.has(entry) || entry.startsWith(".")) continue;
		const fullPath = join(dir, entry);
		const s = await stat(fullPath).catch(() => null);
		if (!s) continue;

		if (s.isDirectory()) {
			results.push(...(await walk(fullPath)));
		} else if (TARGET_EXTENSIONS.has(extname(entry))) {
			results.push(fullPath);
		}
	}
	return results;
}

function inferModuleName(filePath, rootDir) {
	const rel = relative(rootDir, filePath);
	const parts = rel.split("/");

	// Next.js app router: app/(group)/feature/page.tsx → feature
	const appIdx = parts.indexOf("app");
	if (appIdx !== -1) {
		const segments = parts
			.slice(appIdx + 1, -1)
			.filter((s) => !s.startsWith("(") && !s.startsWith("["));
		return segments.pop() || "home";
	}

	// pages dir: pages/dashboard/index.tsx → dashboard
	const pagesIdx = parts.indexOf("pages");
	if (pagesIdx !== -1) {
		const segments = parts
			.slice(pagesIdx + 1, -1)
			.filter((s) => !s.startsWith("["));
		return segments.pop() || "home";
	}

	// Component file: components/FeatureName.tsx → feature-name
	const name = basename(filePath, extname(filePath));
	return name
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();
}

function isPageFile(filePath) {
	const name = basename(filePath);
	return PAGE_PATTERNS.some((p) => p.test(name));
}

async function analyzeFile(filePath) {
	const content = await readFile(filePath, "utf-8");
	const hasDataModule = content.includes("data-module");
	const hasDataIgnore = content.includes("data-ai-eyes-ignore");
	const hasJSXReturn = /return\s*\(?\s*</.test(content);
	const isDefaultExport =
		content.includes("export default") || content.includes("export function");
	const lineCount = content.split("\n").length;

	const sensitiveMatch = SENSITIVE_PATTERNS.some((p) => p.test(content));

	return {
		filePath,
		hasDataModule,
		hasDataIgnore,
		hasJSXReturn,
		isDefaultExport,
		lineCount,
		sensitiveMatch,
		isPage: isPageFile(filePath),
	};
}

async function main() {
	console.log("\n🔍 @ai-eyes Module Detector\n");
	console.log(`Scanning: ${rootDir}\n`);

	const files = await walk(rootDir);
	const analyses = await Promise.all(files.map(analyzeFile));

	const candidates = analyses.filter(
		(a) => a.hasJSXReturn && a.isDefaultExport,
	);

	const alreadyTagged = candidates.filter((a) => a.hasDataModule);
	const pages = candidates.filter((a) => a.isPage && !a.hasDataModule);
	const largeComponents = candidates.filter(
		(a) => !a.isPage && !a.hasDataModule && a.lineCount > 50,
	);
	const sensitiveFiles = analyses.filter(
		(a) => a.sensitiveMatch && !a.hasDataIgnore,
	);

	// Report: Already tagged
	if (alreadyTagged.length > 0) {
		console.log(`✅ Already tagged (${alreadyTagged.length}):`);
		for (const f of alreadyTagged) {
			console.log(`   ${relative(rootDir, f.filePath)}`);
		}
		console.log();
	}

	// Report: Page components needing tags
	if (pages.length > 0) {
		console.log(`📄 Page components — SHOULD add data-module (${pages.length}):`);
		for (const f of pages) {
			const suggested = inferModuleName(f.filePath, rootDir);
			console.log(
				`   ${relative(rootDir, f.filePath)}  →  data-module="${suggested}"`,
			);
		}
		console.log();
	}

	// Report: Large feature components
	if (largeComponents.length > 0) {
		console.log(
			`🧩 Large components — CONSIDER adding data-module (${largeComponents.length}):`,
		);
		for (const f of largeComponents.slice(0, 20)) {
			const suggested = inferModuleName(f.filePath, rootDir);
			console.log(
				`   ${relative(rootDir, f.filePath)} (${f.lineCount} lines)  →  data-module="${suggested}"`,
			);
		}
		if (largeComponents.length > 20) {
			console.log(`   ... and ${largeComponents.length - 20} more`);
		}
		console.log();
	}

	// Report: Sensitive files needing data-ai-eyes-ignore
	if (sensitiveFiles.length > 0) {
		console.log(
			`🔒 Sensitive components — SHOULD add data-ai-eyes-ignore (${sensitiveFiles.length}):`,
		);
		for (const f of sensitiveFiles.slice(0, 15)) {
			console.log(`   ${relative(rootDir, f.filePath)}`);
		}
		console.log();
	}

	// Summary
	const totalSuggested = pages.length + largeComponents.length;
	console.log("─".repeat(50));
	console.log(
		`Summary: ${alreadyTagged.length} tagged, ${totalSuggested} suggested, ${sensitiveFiles.length} need privacy protection`,
	);

	if (totalSuggested === 0 && sensitiveFiles.length === 0) {
		console.log("\n🎉 Your project is fully tagged! No action needed.\n");
	} else {
		console.log(
			"\nRun with your AI assistant: 'integrate ai-eyes and tag modules'\n",
		);
	}
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});
