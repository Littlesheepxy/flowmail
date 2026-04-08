"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import { toastError } from "@repo/ui/components/toast";
import {
	CheckCircle2Icon,
	ClipboardCopyIcon,
	RefreshCwIcon,
	ShieldOffIcon,
	XCircleIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

interface InviteCodesData {
	enabled: boolean;
	codes: string[];
	envVar: string;
}

function generateCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	const segments = [4, 4, 4];
	return segments
		.map((len) =>
			Array.from(
				{ length: len },
				() => chars[Math.floor(Math.random() * chars.length)],
			).join(""),
		)
		.join("-");
}

export function InviteCodesPanel() {
	const [data, setData] = useState<InviteCodesData | null>(null);
	const [loading, setLoading] = useState(true);
	const [generated, setGenerated] = useState<string[]>([]);
	const [copiedCode, setCopiedCode] = useState<string | null>(null);

	async function fetchData() {
		setLoading(true);
		try {
			const res = await fetch("/api/admin/invite-codes");
			if (!res.ok) {
				throw new Error();
			}
			setData(await res.json());
		} catch {
			toastError("Failed to load invite codes.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		fetchData();
	}, []);

	function addGenerated() {
		setGenerated((prev) => [...prev, generateCode()]);
	}

	async function copyCode(code: string) {
		try {
			await navigator.clipboard.writeText(code);
			setCopiedCode(code);
			setTimeout(() => setCopiedCode(null), 2000);
		} catch {
			toastError("Clipboard access denied.");
		}
	}

	async function copyEnvLine() {
		if (!data) {
			return;
		}
		const allCodes = [...data.codes, ...generated];
		const line = `${data.envVar}="${allCodes.join(",")}"`;
		await copyCode(line);
	}

	const allCodes = data ? [...data.codes, ...generated] : [];

	return (
		<Card className="p-6">
			<div className="mb-6 flex items-center justify-between gap-4">
				<div>
					<h2 className="font-semibold text-2xl">邀请码管理</h2>
					<p className="mt-1 text-foreground/60 text-sm">
						邀请码由环境变量{" "}
						<code className="rounded bg-muted px-1 font-mono text-xs">
							FLOWMAIL_INVITE_CODES
						</code>{" "}
						控制。在此生成新码后，将完整的 env
						行复制到你的部署配置中。
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={fetchData}
					disabled={loading}
				>
					<RefreshCwIcon
						className={`size-4 ${loading ? "animate-spin" : ""}`}
					/>
				</Button>
			</div>

			{/* 状态提示 */}
			<div className="mb-6 flex items-center gap-2">
				{data?.enabled ? (
					<>
						<CheckCircle2Icon className="size-4 text-green-500" />
						<span className="text-sm">
							邀请码门禁已启用，共{" "}
							<strong>{data.codes.length}</strong> 个生效中的码
						</span>
					</>
				) : loading ? (
					<span className="text-foreground/50 text-sm">加载中…</span>
				) : (
					<>
						<ShieldOffIcon className="size-4 text-orange-500" />
						<span className="text-sm text-orange-600">
							门禁未启用（
							<code className="font-mono text-xs">
								FLOWMAIL_INVITE_CODES
							</code>{" "}
							为空）
						</span>
					</>
				)}
			</div>

			{/* 现有生效码列表 */}
			{allCodes.length > 0 && (
				<div className="mb-6 overflow-hidden rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>邀请码</TableHead>
								<TableHead className="w-28 text-right">
									状态
								</TableHead>
								<TableHead className="w-16" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{allCodes.map((code, idx) => {
								const isNew = idx >= (data?.codes.length ?? 0);
								return (
									<TableRow key={code}>
										<TableCell>
											<code className="font-mono text-sm">
												{code}
											</code>
										</TableCell>
										<TableCell className="text-right">
											{isNew ? (
												<Badge status="warning">
													待配置
												</Badge>
											) : (
												<Badge status="success">
													生效中
												</Badge>
											)}
										</TableCell>
										<TableCell>
											<Button
												size="icon"
												variant="ghost"
												onClick={() => copyCode(code)}
												title="复制"
											>
												{copiedCode === code ? (
													<CheckCircle2Icon className="size-4 text-green-500" />
												) : (
													<ClipboardCopyIcon className="size-4" />
												)}
											</Button>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}

			{/* 生成新码 */}
			<div className="mb-6 flex flex-wrap gap-2">
				<Button variant="outline" onClick={addGenerated}>
					生成新邀请码
				</Button>
				{generated.length > 0 && (
					<Button
						variant="ghost"
						size="sm"
						className="text-destructive hover:text-destructive"
						onClick={() => setGenerated([])}
					>
						<XCircleIcon className="mr-1 size-4" />
						清除未保存的码
					</Button>
				)}
			</div>

			{/* 部署说明 */}
			<div className="rounded-lg border bg-muted/40 p-4">
				<p className="mb-3 font-medium text-sm">如何生效</p>
				<ol className="space-y-2 text-foreground/70 text-sm">
					<li>1. 在上方点击「生成新邀请码」，或直接使用现有的码</li>
					<li>
						2. 点击下方按钮，复制完整的环境变量行到部署配置（Vercel
						/ Docker / .env.local）
					</li>
					<li>
						3.
						重新部署后，新码立即生效；旧码同样保留（只要保留在列表中）
					</li>
					<li>
						4.{" "}
						<strong>
							将{" "}
							<code className="font-mono">
								NEXT_PUBLIC_INVITE_CODE_REQUIRED=true
							</code>{" "}
							也一并配置，前端才会显示邀请码表单
						</strong>
					</li>
				</ol>

				<div className="mt-4">
					<p className="mb-2 text-foreground/60 text-xs">
						完整 env 行（包含所有已有 + 新生成的码）：
					</p>
					<div className="flex items-center gap-2">
						<Input
							readOnly
							value={
								allCodes.length > 0
									? `${data?.envVar ?? "FLOWMAIL_INVITE_CODES"}="${allCodes.join(",")}"`
									: "(暂无邀请码，先生成一个)"
							}
							className="font-mono text-xs"
						/>
						<Button
							variant="outline"
							size="sm"
							disabled={allCodes.length === 0}
							onClick={copyEnvLine}
						>
							{copiedCode?.includes("FLOWMAIL") ? (
								<>
									<CheckCircle2Icon className="mr-1 size-4 text-green-500" />
									已复制
								</>
							) : (
								<>
									<ClipboardCopyIcon className="mr-1 size-4" />
									复制
								</>
							)}
						</Button>
					</div>
				</div>
			</div>
		</Card>
	);
}
