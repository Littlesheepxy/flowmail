import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	__test_buildDefaultObject as buildDefaultObject,
	__test_coerceToSchema as coerceToSchema,
	__test_unwrapSchema as unwrapSchema,
} from "./safe-generate-object";

describe("unwrapSchema", () => {
	it("plain array<string> stays the same", () => {
		const s = z.array(z.string());
		expect(unwrapSchema(s)._def.type).toBe("array");
	});

	it("array<string>.transform unwraps to array (not pipe/transform)", () => {
		const s = z.array(z.string()).transform((a) => a.slice(0, 5));
		// THIS is the bug we're fixing: pipe → must drill to "in" side (= array),
		// not "out" side (= transform).
		const u = unwrapSchema(s);
		expect(u._def.type).toBe("array");
	});

	it("string.optional unwraps to string", () => {
		const s = z.string().optional();
		expect(unwrapSchema(s)._def.type).toBe("string");
	});

	it("string.nullable.optional unwraps to string", () => {
		const s = z.string().nullable().optional();
		expect(unwrapSchema(s)._def.type).toBe("string");
	});

	it("z.array(...).max(N).transform unwraps to array", () => {
		const s = z
			.array(z.string())
			.max(5)
			.transform((a) => a);
		expect(unwrapSchema(s)._def.type).toBe("array");
	});

	it("enum.optional unwraps to enum", () => {
		const s = z.enum(["a", "b"]).optional();
		expect(unwrapSchema(s)._def.type).toBe("enum");
	});

	it("default unwraps", () => {
		const s = z.string().default("hello");
		expect(unwrapSchema(s)._def.type).toBe("string");
	});
});

describe("coerceToSchema — array fields with .transform", () => {
	// Mirror of the real ReportExtractionSchema field that broke prod.
	const Schema = z.object({
		title: z.string(),
		keyPoints: z
			.array(z.string())
			.transform((arr) => arr.slice(0, 5))
			.describe("Key points, max 5"),
		blockers: z.array(z.string()),
		overallStatus: z.enum(["on_track", "at_risk", "blocked"]),
	});

	it("repairs keyPoints when LLM returns string instead of array", () => {
		const llmOutput = {
			title: "Q4 Report",
			keyPoints: "revenue up; new hire; deal closed", // <- LLM bug
			blockers: [],
			overallStatus: "on_track",
		};
		const coerced = coerceToSchema(llmOutput, Schema);
		expect(Array.isArray(coerced.keyPoints)).toBe(true);
		expect((coerced.keyPoints as string[]).length).toBeGreaterThan(0);
		// Final parse must succeed
		expect(() => Schema.parse(coerced)).not.toThrow();
	});

	it("repairs keyPoints when LLM returns comma-separated string", () => {
		const llmOutput = {
			title: "x",
			keyPoints: "a, b, c",
			blockers: [],
			overallStatus: "on_track",
		};
		const coerced = coerceToSchema(llmOutput, Schema);
		expect((coerced.keyPoints as string[]).length).toBe(3);
	});

	it("does not split numbers like '1,234' inside one item", () => {
		const llmOutput = {
			title: "x",
			keyPoints: "Revenue 1,234,567 USD",
			blockers: [],
			overallStatus: "on_track",
		};
		const coerced = coerceToSchema(llmOutput, Schema);
		// Should stay as one item, not get split on the thousands commas
		expect((coerced.keyPoints as string[])[0]).toContain("1,234,567");
	});

	it("repairs array given as null", () => {
		const llmOutput = {
			title: "x",
			keyPoints: null,
			blockers: null,
			overallStatus: "blocked",
		};
		const coerced = coerceToSchema(llmOutput, Schema);
		expect(coerced.keyPoints).toEqual([]);
		expect(coerced.blockers).toEqual([]);
	});

	it("repairs array given as object-as-array", () => {
		const llmOutput = {
			title: "x",
			keyPoints: { 0: "a", 1: "b" },
			blockers: [],
			overallStatus: "on_track",
		};
		const coerced = coerceToSchema(llmOutput, Schema);
		expect(coerced.keyPoints).toEqual(["a", "b"]);
	});

	it("repairs enum case mismatch", () => {
		const llmOutput = {
			title: "x",
			keyPoints: ["ok"],
			blockers: [],
			overallStatus: "On Track", // wrong case + space
		};
		const coerced = coerceToSchema(llmOutput, Schema);
		expect(coerced.overallStatus).toBe("on_track");
	});
});

describe("buildDefaultObject — through transforms", () => {
	const Schema = z.object({
		title: z.string(),
		keyPoints: z.array(z.string()).transform((arr) => arr.slice(0, 5)),
		count: z.number(),
		nested: z.object({ name: z.string(), email: z.string() }),
		status: z.enum(["a", "b"]),
	});

	it("produces a parseable skeleton", () => {
		const skeleton = buildDefaultObject(Schema);
		expect(skeleton).toMatchObject({
			title: "",
			keyPoints: [],
			count: 0,
			status: "a",
		});
		expect(() => Schema.parse(skeleton)).not.toThrow();
	});
});

describe("Real-world ReportExtractionSchema reproduction", () => {
	// Exact copy of packages/email-processor/src/schemas/report.ts
	const ReportExtractionSchema = z.object({
		title: z.string().describe("Report title"),
		reporter: z
			.object({ name: z.string(), email: z.string() })
			.describe("Reporter info"),
		period: z
			.object({
				type: z.enum(["daily", "weekly", "monthly", "ad_hoc"]),
				startDate: z.string().nullable().optional(),
				endDate: z.string().nullable().optional(),
			})
			.describe("Reporting period"),
		keyPoints: z
			.array(z.string())
			.transform((arr) => arr.slice(0, 5))
			.describe("Key points, max 5"),
		completedItems: z.array(z.string()),
		inProgressItems: z.array(z.string()),
		blockers: z.array(z.string()),
		nextActions: z.array(z.string()),
		overallStatus: z.enum(["on_track", "at_risk", "blocked"]),
	});

	it("FIXED: LLM returns keyPoints as string → no longer throws", () => {
		const llmOutput = {
			title: "Blue Sky Update",
			reporter: { name: "Taylor Wilson", email: "" },
			period: { type: "ad_hoc", startDate: null, endDate: null },
			keyPoints:
				"Lockhart proforma updated; budget approved; site visit scheduled",
			completedItems: ["Initial review"],
			inProgressItems: ["Due diligence"],
			blockers: [],
			nextActions: ["Schedule call"],
			overallStatus: "on_track",
		};
		const coerced = coerceToSchema(llmOutput, ReportExtractionSchema);
		const result = ReportExtractionSchema.safeParse(coerced);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.keyPoints.length).toBeGreaterThan(0);
		}
	});
});
