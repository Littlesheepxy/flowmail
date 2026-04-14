import { tool } from "@repo/ai";
import { z } from "zod";
import { createContext, runInContext, type Context } from "node:vm";
import { spawn } from "node:child_process";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 50_000;

function truncateOutput(output: string): { text: string; truncated: boolean } {
	if (output.length <= MAX_OUTPUT_CHARS) {
		return { text: output, truncated: false };
	}
	return {
		text: `${output.slice(0, MAX_OUTPUT_CHARS)}\n\n... [输出被截断，共 ${output.length} 字符]`,
		truncated: true,
	};
}

function runJavaScript(code: string): Promise<{ stdout: string; stderr: string; result: unknown; duration: number }> {
	return new Promise((resolve) => {
		const start = Date.now();
		const logs: string[] = [];
		const errors: string[] = [];

		const sandbox: Record<string, unknown> = {
			console: {
				log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
				error: (...args: unknown[]) => errors.push(args.map(String).join(" ")),
				warn: (...args: unknown[]) => logs.push(`[warn] ${args.map(String).join(" ")}`),
				info: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
			},
			JSON,
			Math,
			Date,
			Number,
			String,
			Array,
			Object,
			Map,
			Set,
			RegExp,
			parseInt,
			parseFloat,
			isNaN,
			isFinite,
			encodeURIComponent,
			decodeURIComponent,
			setTimeout: undefined,
			setInterval: undefined,
			fetch: undefined,
			process: undefined,
			require: undefined,
		};

		const ctx: Context = createContext(sandbox);

		try {
			const result = runInContext(code, ctx, {
				timeout: TIMEOUT_MS,
				displayErrors: true,
			});
			resolve({
				stdout: logs.join("\n"),
				stderr: errors.join("\n"),
				result: result !== undefined ? result : null,
				duration: Date.now() - start,
			});
		} catch (err) {
			resolve({
				stdout: logs.join("\n"),
				stderr: err instanceof Error ? err.message : String(err),
				result: null,
				duration: Date.now() - start,
			});
		}
	});
}

async function runPython(code: string): Promise<{ stdout: string; stderr: string; exitCode: number; duration: number }> {
	const start = Date.now();
	let tmpDir: string;
	let scriptPath: string;

	try {
		tmpDir = await mkdtemp(join(tmpdir(), "flowmail-py-"));
		scriptPath = join(tmpDir, "script.py");
		await writeFile(scriptPath, code, "utf-8");
	} catch (err) {
		return {
			stdout: "",
			stderr: `文件写入失败: ${err instanceof Error ? err.message : String(err)}`,
			exitCode: 1,
			duration: Date.now() - start,
		};
	}

	return new Promise((resolve) => {
		const proc = spawn("python3", [scriptPath], {
			timeout: TIMEOUT_MS,
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				PYTHONIOENCODING: "utf-8",
				PYTHONDONTWRITEBYTECODE: "1",
			},
		});

		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];

		proc.stdout.on("data", (d) => stdout.push(d));
		proc.stderr.on("data", (d) => stderr.push(d));

		proc.on("close", async (code) => {
			try {
				await unlink(scriptPath);
			} catch { /* ignore */ }
			resolve({
				stdout: Buffer.concat(stdout).toString("utf-8"),
				stderr: Buffer.concat(stderr).toString("utf-8"),
				exitCode: code ?? 1,
				duration: Date.now() - start,
			});
		});

		proc.on("error", async (err) => {
			try {
				await unlink(scriptPath);
			} catch { /* ignore */ }
			resolve({
				stdout: "",
				stderr: err.message.includes("ENOENT")
					? "Python3 未安装或不在 PATH 中。请在服务器上安装 Python3。"
					: err.message,
				exitCode: 1,
				duration: Date.now() - start,
			});
		});

		proc.stdin.end();
	});
}

export function createSandboxTools() {
	return {
		run_code: tool({
			description: `在安全沙箱中执行 JavaScript 代码。适用于：
- 数据处理、数值计算、统计分析
- CSV/JSON 数据解析和转换
- 字符串处理、正则提取
- 表格数据汇总、排序、过滤
- 生成格式化报告

代码通过 console.log() 输出结果。不支持 fetch/网络请求/文件读写。
如需处理附件数据，先用 read_attachment 获取内容，再将数据嵌入代码中处理。`,
			inputSchema: z.object({
				code: z.string().describe("要执行的 JavaScript 代码"),
				description: z.string().optional().describe("代码功能的简要说明"),
			}),
			execute: async (input: { code: string; description?: string }) => {
				const result = await runJavaScript(input.code);
				const stdoutResult = truncateOutput(result.stdout);

				return {
					success: !result.stderr,
					stdout: stdoutResult.text || "(无输出)",
					stderr: result.stderr || undefined,
					returnValue: result.result,
					truncated: stdoutResult.truncated,
					durationMs: result.duration,
					description: input.description,
				};
			},
		}),

		run_python: tool({
			description: `在服务器上执行 Python 脚本。适用于：
- 复杂数据分析（如果安装了 pandas/numpy）
- 数学计算、统计建模
- 文本处理、NLP 预处理
- 数据可视化脚本生成
- 任何需要 Python 生态的场景

代码通过 print() 输出结果。有 30 秒超时限制。
注意：需要服务器上安装了 Python3。`,
			inputSchema: z.object({
				code: z.string().describe("要执行的 Python 代码"),
				description: z.string().optional().describe("脚本功能的简要说明"),
				packages: z.array(z.string()).optional().describe("需要的 pip 包（仅提示用途，不会自动安装）"),
			}),
			execute: async (input: { code: string; description?: string; packages?: string[] }) => {
				const result = await runPython(input.code);
				const stdoutResult = truncateOutput(result.stdout);
				const stderrResult = truncateOutput(result.stderr);

				return {
					success: result.exitCode === 0,
					stdout: stdoutResult.text || "(无输出)",
					stderr: stderrResult.text || undefined,
					exitCode: result.exitCode,
					truncated: stdoutResult.truncated || stderrResult.truncated,
					durationMs: result.duration,
					description: input.description,
					missingPackages: input.packages,
				};
			},
		}),
	};
}
