/**
 * Playwright global setup — runs once before all test suites.
 *
 * Creates test user, organization, seed data, and session entirely via DB.
 * Signs the session cookie using the same HMAC-SHA-256 mechanism as Hono/better-auth.
 * This approach completely bypasses the API and avoids rate limiting issues.
 */
import nodeCrypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";

const TEST_EMAIL = "test@flowmail.dev";
const TEST_PASSWORD = "Test123456!";
const TEST_NAME = "Test User";
const ORG_SLUG = "e2e-org";
const ORG_NAME = "E2E Org";

const AUTH_DIR = path.resolve(__dirname, ".auth");
const AUTH_FILE = path.resolve(AUTH_DIR, "user.json");

const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateRandomString(length: number): string {
	const bytes = nodeCrypto.randomBytes(length);
	let result = "";
	for (let i = 0; i < length; i++) {
		result += CHARS[bytes[i] % CHARS.length];
	}
	return result;
}

function signToken(token: string, secret: string): string {
	const signature = nodeCrypto
		.createHmac("sha256", secret)
		.update(token)
		.digest("base64");
	return `${token}.${signature}`;
}

export default async function globalSetup() {
	const dbUrl = process.env.DATABASE_URL;
	const secret =
		process.env.BETTER_AUTH_SECRET ||
		process.env.AUTH_SECRET ||
		"better-auth-default-secret-please-change";

	if (!dbUrl) {
		console.warn("[global-setup] DATABASE_URL not set, skipping.");
		return;
	}

	const client = new pg.Client({ connectionString: dbUrl });

	try {
		await client.connect();

		// 1. Ensure test user exists
		let userId: string;
		const existing = await client.query(
			'SELECT id FROM "user" WHERE email = $1',
			[TEST_EMAIL],
		);

		if (existing.rows.length > 0) {
			userId = existing.rows[0].id;
		} else {
			userId = nodeCrypto.randomUUID();
			const hashed = await hashPassword(TEST_PASSWORD);
			const now = new Date();

			await client.query(
				`INSERT INTO "user" (id, name, email, "emailVerified", "onboardingComplete", "createdAt", "updatedAt")
				 VALUES ($1, $2, $3, true, false, $4, $4)`,
				[userId, TEST_NAME, TEST_EMAIL, now],
			);
			await client.query(
				`INSERT INTO "account" (id, "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
				 VALUES ($1, $2, 'credential', $3, $4, $5, $5)`,
				[nodeCrypto.randomUUID(), userId, userId, hashed, now],
			);
			console.log("[global-setup] Created user:", TEST_EMAIL);
		}

		// 2. Ensure organization exists
		let orgId: string;
		const orgResult = await client.query(
			'SELECT id FROM "organization" WHERE slug = $1',
			[ORG_SLUG],
		);

		if (orgResult.rows.length > 0) {
			orgId = orgResult.rows[0].id;
		} else {
			orgId = nodeCrypto.randomUUID();
			const now = new Date();
			await client.query(
				`INSERT INTO "organization" (id, name, slug, "createdAt", "updatedAt")
				 VALUES ($1, $2, $3, $4, $4)`,
				[orgId, ORG_NAME, ORG_SLUG, now],
			);
			await client.query(
				`INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt")
				 VALUES ($1, $2, $3, 'owner', $4)`,
				[nodeCrypto.randomUUID(), orgId, userId, now],
			);
			console.log("[global-setup] Created org:", ORG_SLUG);
		}

		// 3. Seed entity data if org is empty
		const entityCount = await client.query(
			'SELECT COUNT(*) as count FROM "flow_entity" WHERE "organizationId" = $1',
			[orgId],
		);
		if (Number(entityCount.rows[0]?.count ?? 0) === 0) {
			await seedMinimalData(client, orgId);
		}

		// 4. Create session directly in the DB
		const sessionToken = generateRandomString(32);
		const sessionId = nodeCrypto.randomUUID();
		const now = new Date();
		const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

		await client.query('DELETE FROM "session" WHERE "userId" = $1', [
			userId,
		]);

		await client.query(
			`INSERT INTO "session" (id, "expiresAt", "userId", token, "activeOrganizationId", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $6, $6)`,
			[sessionId, expiresAt, userId, sessionToken, orgId, now],
		);
		console.log("[global-setup] Created session in DB");

		// 5. Sign the token (same HMAC-SHA-256 as Hono's setSignedCookie)
		const signedToken = signToken(sessionToken, secret);

		// 6. Write storageState
		fs.mkdirSync(AUTH_DIR, { recursive: true });
		const storageState = {
			cookies: [
				{
					name: "better-auth.session_token",
					value: signedToken,
					domain: "localhost",
					path: "/",
					expires: expiresAt.getTime() / 1000,
					httpOnly: true,
					secure: false,
					sameSite: "Lax" as const,
				},
			],
			origins: [],
		};
		fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2));

		// 8. Write test context (org info) for fixtures to read without API calls
		const testContext = { orgId, orgSlug: ORG_SLUG, userId };
		fs.writeFileSync(
			path.resolve(AUTH_DIR, "context.json"),
			JSON.stringify(testContext, null, 2),
		);
		console.log("[global-setup] Auth state saved (DB-signed session)");
	} catch (e) {
		console.error(
			"[global-setup] Error:",
			e instanceof Error ? e.message : String(e),
		);
	} finally {
		await client.end();
	}
}

async function seedMinimalData(client: pg.Client, orgId: string) {
	const now = new Date();
	const daysAgo = (n: number) => {
		const d = new Date();
		d.setDate(d.getDate() - n);
		return d;
	};

	const catApproval = nodeCrypto.randomUUID();
	const catReport = nodeCrypto.randomUUID();
	await client.query(
		`INSERT INTO "category" (id, "organizationId", name, slug, icon, color, "aiPrompt", "sortOrder", "isDefault", "createdAt", "updatedAt")
		 VALUES ($1, $2, '审批', 'approval', 'CheckSquareIcon', '#6366f1', '审批请求', 0, true, $3, $3),
		        ($4, $2, '汇报跟踪', 'report', 'BarChart2Icon', '#10b981', '进展汇报', 1, false, $3, $3)`,
		[catApproval, orgId, now, catReport],
	);

	const connId = nodeCrypto.randomUUID();
	await client.query(
		`INSERT INTO "email_connection" (id, "organizationId", provider, "authType", email, "isActive", "lastSyncAt", "createdAt", "updatedAt")
		 VALUES ($1, $2, 'gmail', 'oauth2', 'demo@flowmail.ai', true, $3, $3, $3)`,
		[connId, orgId, now],
	);

	const e1Id = nodeCrypto.randomUUID();
	await client.query(
		`INSERT INTO "flow_entity" (id, "organizationId", type, "categoryId", title, status, "aiConfidence", "requiresReview",
		 "extractedFields", "aiSummary", "createdAt", "updatedAt")
		 VALUES ($1, $2, 'APPROVAL', $3, '生产环境服务器扩容申请（紧急）', 'pending', 0.91, false,
		 $4, '基础设施组紧急申请扩容生产服务器', $5, $6)`,
		[
			e1Id,
			orgId,
			catApproval,
			JSON.stringify({
				applicant: "李工（基础设施组）",
				monthlyCost: "¥18,400/月",
				urgency: "紧急",
			}),
			daysAgo(1),
			now,
		],
	);

	await client.query(
		`INSERT INTO "email_thread" (id, "organizationId", "connectionId", "externalThreadId", subject, sender, "senderName",
		 participants, snippet, "entityId", "receivedAt", "processedAt", "createdAt")
		 VALUES ($1, $2, $3, 'thread_e2e_001', '【紧急】生产服务器扩容申请', 'ligong@company.com', '李工',
		 '[]', '生产环境 CPU 持续 >90%', $4, $5, $5, $5)`,
		[nodeCrypto.randomUUID(), orgId, connId, e1Id, daysAgo(1)],
	);

	await client.query(
		`INSERT INTO "timeline_event" (id, "entityId", type, content, metadata, "createdAt")
		 VALUES ($1, $2, 'email_received', '收到李工的紧急扩容申请', $3, $4),
		        ($5, $2, 'ai_summary', 'AI 解析完成：紧急审批请求', $6, $7)`,
		[
			nodeCrypto.randomUUID(),
			e1Id,
			JSON.stringify({ sender: "ligong@company.com" }),
			daysAgo(1),
			nodeCrypto.randomUUID(),
			JSON.stringify({ confidence: 0.91, categorySlug: "approval" }),
			daysAgo(1),
		],
	);

	const e2Id = nodeCrypto.randomUUID();
	await client.query(
		`INSERT INTO "flow_entity" (id, "organizationId", type, "categoryId", title, status, "aiConfidence", "requiresReview",
		 "extractedFields", "aiSummary", "createdAt", "updatedAt")
		 VALUES ($1, $2, 'APPROVAL', $3, 'Q1 营销预算审批申请 ¥200,000', 'approved', 0.95, false,
		 $4, '市场部张明申请 Q1 营销预算', $5, $6)`,
		[
			e2Id,
			orgId,
			catApproval,
			JSON.stringify({ applicant: "张明（市场部）", amount: "¥200,000" }),
			daysAgo(7),
			daysAgo(1),
		],
	);

	await client.query(
		`INSERT INTO "timeline_event" (id, "entityId", type, content, metadata, "createdAt")
		 VALUES ($1, $2, 'action_taken', '已批准：同意 Q1 营销预算', $3, $4)`,
		[
			nodeCrypto.randomUUID(),
			e2Id,
			JSON.stringify({ action: "approved", comment: "同意" }),
			daysAgo(1),
		],
	);

	await client.query(
		`INSERT INTO "flow_entity" (id, "organizationId", type, "categoryId", title, status, "aiConfidence", "requiresReview",
		 "extractedFields", "aiSummary", "createdAt", "updatedAt")
		 VALUES ($1, $2, 'REPORT', $3, '后端架构重构项目 - 进度跟踪', 'in_progress', 0.88, false,
		 $4, '后端重构项目整体进度 62%', $5, $6)`,
		[
			nodeCrypto.randomUUID(),
			orgId,
			catReport,
			JSON.stringify({
				projectLead: "王芳（后端组）",
				overallProgress: "62%",
			}),
			daysAgo(28),
			daysAgo(1),
		],
	);

	console.log("[global-setup] Seeded 3 entities");

	await seedUnclassifiedEmails(client, orgId, connId);
}

async function seedUnclassifiedEmails(
	client: pg.Client,
	orgId: string,
	connId: string,
) {
	const emails = [
		{
			ext: "unclass_001",
			subject: "[BUILD FAILED] api-service #1234",
			sender: "jenkins@company.com",
			senderName: "Jenkins CI",
			snippet: "Build failed: api-service. Error: test timeout",
		},
		{
			ext: "unclass_002",
			subject: "Re: Q2产品路线图讨论",
			sender: "pm@company.com",
			senderName: "产品经理",
			snippet: "关于Q2的规划，我有几点建议…",
		},
		{
			ext: "unclass_003",
			subject: "[ALERT] CPU Usage > 90%",
			sender: "monitor@company.com",
			senderName: "Monitor System",
			snippet: "Server prod-api-3 CPU usage reached 95%",
		},
		{
			ext: "unclass_004",
			subject: "本周工作汇报 - 前端组",
			sender: "frontend@company.com",
			senderName: "前端组长",
			snippet: "本周完成了登录页面重构、性能优化…",
		},
		{
			ext: "unclass_005",
			subject: "客户反馈：导出功能异常",
			sender: "support@company.com",
			senderName: "客服",
			snippet: "客户A反馈导出Excel时出现空白",
		},
		{
			ext: "unclass_006",
			subject: "Re: 新人入职培训安排",
			sender: "hr@company.com",
			senderName: "HR",
			snippet: "请确认下周新人的培训日程",
		},
		{
			ext: "unclass_007",
			subject: "[DEPLOY] v2.3.1 production release",
			sender: "jenkins@company.com",
			senderName: "Jenkins CI",
			snippet: "Deployment successful: v2.3.1 to production",
		},
		{
			ext: "unclass_008",
			subject: "需求评审：用户权限管理模块",
			sender: "pm@company.com",
			senderName: "产品经理",
			snippet: "请参加明天下午3点的需求评审会议",
		},
	];

	for (const e of emails) {
		const receivedAt = new Date(
			Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
		);
		await client.query(
			`INSERT INTO "email_thread" (id, "organizationId", "connectionId", "externalThreadId", subject, sender, "senderName",
			 participants, snippet, "bodyText", "entityId", "receivedAt", "createdAt")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, '[]', $8, $9, NULL, $10, $10)
			 ON CONFLICT ("connectionId", "externalThreadId") DO NOTHING`,
			[
				nodeCrypto.randomUUID(),
				orgId,
				connId,
				e.ext,
				e.subject,
				e.sender,
				e.senderName,
				e.snippet,
				`${e.snippet}\n\n这是完整的邮件正文内容。包含更多细节…`,
				receivedAt,
			],
		);
	}

	console.log("[global-setup] Seeded 8 unclassified emails");
}
