import { auth } from "@repo/auth";
import { db } from "@repo/database";
import { uploadObject } from "@repo/storage";
import { logger } from "@repo/logs";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

/**
 * 回填 Resend 入站附件（storageKey 为 NULL 的存量数据）。
 *
 * 老数据写入时还没用 Resend Attachments API（webhook payload 里没附件二进制内容），
 * 所以 storageKey 是空的 → UI 显示"暂不可下载"。Resend 的 receiving 接口在邮件
 * 接收后一段时间内仍可拿到附件 download_url，本端点扫库批量回拉上传到 minio/S3。
 *
 * 用法：
 *   curl -X POST https://flowmail.maoxianer.com/api/admin/backfill-attachments \
 *     -H 'Cookie: <admin session>' \
 *     -H 'content-type: application/json' \
 *     -d '{"limit":50,"organizationId":"optional","dryRun":false}'
 */
export async function POST(req: NextRequest) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (session.user.role !== "admin") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		return NextResponse.json(
			{ error: "RESEND_API_KEY not configured" },
			{ status: 500 },
		);
	}

	const storageEnabled = !!(
		process.env.S3_ENDPOINT &&
		process.env.S3_ACCESS_KEY_ID &&
		process.env.S3_SECRET_ACCESS_KEY
	);
	if (!storageEnabled) {
		return NextResponse.json(
			{ error: "Object storage not configured" },
			{ status: 500 },
		);
	}

	const body = (await req.json().catch(() => ({}))) as {
		limit?: number;
		organizationId?: string;
		dryRun?: boolean;
	};
	const limit = Math.min(body.limit ?? 50, 200);
	const dryRun = body.dryRun === true;

	// 找 storageKey 为空的附件，且能从 inbound_email 反查到 Resend email_id
	// （externalId 字段我们写入时存的是 Resend attachment id）
	const attachments = await db.emailAttachment.findMany({
		where: {
			storageKey: null,
			thread:
				body.organizationId !== undefined
					? { organizationId: body.organizationId }
					: undefined,
		},
		take: limit,
		orderBy: { createdAt: "desc" },
		include: {
			thread: {
				select: { id: true, organizationId: true },
			},
		},
	});

	const results: Array<{
		attachmentId: string;
		filename: string;
		status: "ok" | "skipped" | "error" | "would_fetch";
		message?: string;
		size?: number;
	}> = [];

	for (const att of attachments) {
		// 反查 inbound_email 拿 email_id（rawPayload.email_id）
		// 我们的 externalId = Resend att.id，但 rawPayload 里也有附件列表
		const inbound = await db.inboundEmail.findFirst({
			where: {
				organizationId: att.thread.organizationId,
				rawPayload: { string_contains: att.externalId },
			},
			orderBy: { createdAt: "desc" },
			select: { rawPayload: true },
		});

		const payload = inbound?.rawPayload as
			| { email_id?: string; attachments?: Array<{ id?: string; filename?: string }> }
			| null
			| undefined;

		const emailId = payload?.email_id;
		if (!emailId) {
			results.push({
				attachmentId: att.id,
				filename: att.filename,
				status: "skipped",
				message: "no inbound_email match",
			});
			continue;
		}

		if (dryRun) {
			results.push({
				attachmentId: att.id,
				filename: att.filename,
				status: "would_fetch",
				message: `email_id=${emailId} att=${att.externalId}`,
			});
			continue;
		}

		try {
			const metaRes = await fetch(
				`https://api.resend.com/emails/receiving/${emailId}/attachments/${att.externalId}`,
				{ headers: { Authorization: `Bearer ${apiKey}` } },
			);
			if (!metaRes.ok) {
				throw new Error(`metadata HTTP ${metaRes.status}`);
			}
			const meta = (await metaRes.json()) as {
				download_url?: string;
				content_type?: string;
			};
			if (!meta.download_url) {
				throw new Error("no download_url");
			}

			const fileRes = await fetch(meta.download_url);
			if (!fileRes.ok) {
				throw new Error(`download HTTP ${fileRes.status}`);
			}
			const buf = Buffer.from(await fileRes.arrayBuffer());

			const storageKey = `attachments/${att.thread.organizationId}/${emailId}/${att.filename}`;
			await uploadObject(storageKey, buf, {
				bucket: "attachments",
				contentType:
					meta.content_type ?? att.mimeType ?? "application/octet-stream",
			});

			await db.emailAttachment.update({
				where: { id: att.id },
				data: { storageKey, size: buf.length },
			});

			results.push({
				attachmentId: att.id,
				filename: att.filename,
				status: "ok",
				size: buf.length,
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.warn("Backfill attachment failed", {
				attachmentId: att.id,
				filename: att.filename,
				emailId,
				error: msg,
			});
			results.push({
				attachmentId: att.id,
				filename: att.filename,
				status: "error",
				message: msg,
			});
		}
	}

	const ok = results.filter((r) => r.status === "ok").length;
	const skipped = results.filter((r) => r.status === "skipped").length;
	const errored = results.filter((r) => r.status === "error").length;

	return NextResponse.json({
		scanned: attachments.length,
		ok,
		skipped,
		errored,
		dryRun,
		results,
	});
}

export async function GET() {
	// 给个轻量 GET 报数：还有多少附件待回填
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (session.user.role !== "admin") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const total = await db.emailAttachment.count({
		where: { storageKey: null },
	});

	return NextResponse.json({
		pendingBackfill: total,
		hint: "POST {limit:50,dryRun:true} 试运行；POST {limit:50} 实际回填",
	});
}
