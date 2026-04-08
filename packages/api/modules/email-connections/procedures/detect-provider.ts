import { resolveMx } from "node:dns/promises";
import { publicProcedure } from "../../../orpc/procedures";
import { z } from "zod";

const detectProviderSchema = z.object({
	email: z.string().email(),
});

type DetectedProvider =
	| "gmail"
	| "outlook"
	| "feishu"
	| "dingtalk"
	| "wecom"
	| "qq"
	| "netease"
	| "yahoo"
	| "icloud"
	| "ali-enterprise"
	| "unknown";

interface DetectResult {
	provider: DetectedProvider;
	method: "oauth" | "imap" | "forward";
	label: string;
	imapHost?: string;
	imapPort?: number;
}

const WELL_KNOWN_IMAP: Record<string, { host: string; port: number }> = {
	qq: { host: "imap.qq.com", port: 993 },
	netease: { host: "imap.163.com", port: 993 },
	yahoo: { host: "imap.mail.yahoo.com", port: 993 },
	icloud: { host: "imap.mail.me.com", port: 993 },
	"ali-enterprise": { host: "imap.mxhichina.com", port: 993 },
};

const DOMAIN_EXACT_MAP: Record<string, DetectedProvider> = {
	"gmail.com": "gmail",
	"googlemail.com": "gmail",
	"outlook.com": "outlook",
	"hotmail.com": "outlook",
	"live.com": "outlook",
	"msn.com": "outlook",
	"outlook.cn": "outlook",
	"hotmail.co.uk": "outlook",
	"live.co.uk": "outlook",
	"live.cn": "outlook",
	"feishu.cn": "feishu",
	"larksuite.com": "feishu",
	"dingtalk.com": "dingtalk",
	"qq.com": "qq",
	"foxmail.com": "qq",
	"163.com": "netease",
	"126.com": "netease",
	"yeah.net": "netease",
	"yahoo.com": "yahoo",
	"yahoo.co.jp": "yahoo",
	"icloud.com": "icloud",
	"me.com": "icloud",
	"mac.com": "icloud",
};

interface MxPattern {
	pattern: RegExp;
	provider: DetectedProvider;
}

const MX_PATTERNS: MxPattern[] = [
	{ pattern: /google\.com$|googlemail\.com$/i, provider: "gmail" },
	{ pattern: /outlook\.com$|protection\.outlook\.com$|microsoft\.com$/i, provider: "outlook" },
	{ pattern: /feishu\.cn$|larksuite\.com$/i, provider: "feishu" },
	{ pattern: /alibaba-inc\.com$|dingtalk\.com$/i, provider: "dingtalk" },
	{ pattern: /exmail\.qq\.com$|qq\.com$/i, provider: "qq" },
	{ pattern: /163\.com$|netease\.com$/i, provider: "netease" },
	{ pattern: /yahoodns\.net$|yahoo\.com$/i, provider: "yahoo" },
	{ pattern: /icloud\.com$|apple\.com$/i, provider: "icloud" },
	{ pattern: /mxhichina\.com$|hichina\.com$/i, provider: "ali-enterprise" },
];

function providerToResult(provider: DetectedProvider): DetectResult {
	switch (provider) {
		case "gmail":
			return { provider, method: "oauth", label: "Gmail / Google Workspace" };
		case "outlook":
			return { provider, method: "oauth", label: "Outlook / Microsoft 365" };
		case "feishu":
			return { provider, method: "oauth", label: "飞书邮箱" };
		case "dingtalk":
			return { provider, method: "oauth", label: "钉钉邮箱" };
		case "wecom":
			return { provider, method: "oauth", label: "企微邮箱" };
		case "qq":
			return {
				provider,
				method: "imap",
				label: "QQ 邮箱",
				...WELL_KNOWN_IMAP.qq,
			};
		case "netease":
			return {
				provider,
				method: "imap",
				label: "网易邮箱",
				...WELL_KNOWN_IMAP.netease,
			};
		case "yahoo":
			return {
				provider,
				method: "imap",
				label: "Yahoo 邮箱",
				...WELL_KNOWN_IMAP.yahoo,
			};
		case "icloud":
			return {
				provider,
				method: "imap",
				label: "iCloud 邮箱",
				...WELL_KNOWN_IMAP.icloud,
			};
		case "ali-enterprise":
			return {
				provider,
				method: "imap",
				label: "阿里企业邮箱",
				...WELL_KNOWN_IMAP["ali-enterprise"],
			};
		default:
			return { provider: "unknown", method: "forward", label: "未知邮箱" };
	}
}

export const detectProvider = publicProcedure
	.route({
		method: "POST",
		path: "/email-connections/detect-provider",
		tags: ["EmailConnections"],
		summary: "Detect email provider via domain + MX lookup",
	})
	.input(detectProviderSchema)
	.handler(async ({ input }) => {
		const domain = input.email.split("@")[1]?.toLowerCase();
		if (!domain) {
			return providerToResult("unknown");
		}

		const exact = DOMAIN_EXACT_MAP[domain];
		if (exact) {
			return providerToResult(exact);
		}

		try {
			const mxRecords = await resolveMx(domain);
			if (mxRecords.length > 0) {
				const sorted = mxRecords.sort((a, b) => a.priority - b.priority);
				for (const mx of sorted) {
					const exchange = mx.exchange.toLowerCase();
					for (const { pattern, provider } of MX_PATTERNS) {
						if (pattern.test(exchange)) {
							return providerToResult(provider);
						}
					}
				}
			}
		} catch {
			// DNS lookup failed — domain may not have MX records
		}

		return providerToResult("unknown");
	});
