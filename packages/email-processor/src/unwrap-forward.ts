/**
 * 转发邮件解包模块
 *
 * 检测通过企业邮箱转发到个人邮箱（如 163）再 IMAP 同步进来的邮件，
 * 从转发模板中提取原始发件人、主题和正文。
 *
 * 支持的格式：Gmail、Outlook、163/网易、QQ/Foxmail、Apple Mail
 */

export interface UnwrapResult {
	isForwarded: boolean;
	originalSender?: string;
	originalSenderName?: string;
	originalSubject?: string;
	originalDate?: string;
	originalTo?: string;
	cleanBody?: string;
	forwarder?: string;
	forwarderEmail?: string;
}

const FORWARD_SUBJECT_RE = /^(Fwd?:|Fw:|转发[:：])\s*/i;

const FORWARD_SEPARATOR_PATTERNS = [
	/^-{3,}\s*转发的邮件信息?\s*-{3,}/m,
	/^-{3,}\s*转发邮件\s*-{3,}/m,
	/^-{3,}\s*转发的邮件\s*-{3,}/m,
	/^-{3,}\s*Forwarded message\s*-{3,}/mi,
	/^-{3,}\s*Original Message\s*-{3,}/mi,
	/^-{3,}\s*邮件原件\s*-{3,}/mi,
	/^-{3,}\s*Original\s*-{3,}/mi,
	/^Begin forwarded message:/mi,
];

const HEADER_PATTERNS: Record<string, RegExp> = {
	from: /^(?:发件人|From|来自|寄件者)[：:]\s*(.+)/i,
	date: /^(?:日期|Date|发送时间|时间|日　期)[：:]\s*(.+)/i,
	to: /^(?:收件人|To|致|至)[：:]\s*(.+)/i,
	cc: /^(?:抄送|Cc)[：:]\s*(.+)/i,
	subject: /^(?:主题|Subject|主　题)[：:]\s*(.+)/i,
};

const EMAIL_RE = /<([^>]+@[^>]+)>/;
const BARE_EMAIL_RE = /[\w.+-]+@[\w.-]+\.\w{2,}/;

function extractEmail(raw: string): { email: string; name: string } | null {
	const angleMatch = raw.match(EMAIL_RE);
	if (angleMatch) {
		const email = angleMatch[1];
		const name = raw.slice(0, raw.indexOf("<")).replace(/['"]/g, "").trim();
		return { email, name: name || email.split("@")[0] };
	}
	const bareMatch = raw.match(BARE_EMAIL_RE);
	if (bareMatch) {
		const email = bareMatch[0];
		const name = raw.replace(email, "").replace(/['"<>]/g, "").trim();
		return { email, name: name || email.split("@")[0] };
	}
	return null;
}

/**
 * 从邮件正文中找到转发分隔线的位置，返回分隔线之后的内容。
 * 如果没有找到分隔线，返回 null。
 */
function findForwardBlock(body: string): { separatorIndex: number; afterSeparator: string } | null {
	for (const pattern of FORWARD_SEPARATOR_PATTERNS) {
		const match = body.match(pattern);
		if (match?.index !== undefined) {
			const afterSep = body.slice(match.index + match[0].length).trimStart();
			return { separatorIndex: match.index, afterSeparator: afterSep };
		}
	}
	return null;
}

/**
 * 从转发头部区域中解析元数据行（发件人、日期、主题等）。
 * 返回解析出的字段和头部结束后的正文起始位置。
 */
function parseForwardHeaders(text: string): {
	headers: Record<string, string>;
	bodyStart: number;
} {
	const headers: Record<string, string> = {};
	const lines = text.split("\n");
	let lastHeaderLine = -1;
	let currentKey: string | null = null;

	for (let i = 0; i < lines.length && i < 20; i++) {
		const line = lines[i].trim();

		if (line === "") {
			if (lastHeaderLine >= 0) {
				break;
			}
			continue;
		}

		let matched = false;
		for (const [key, pattern] of Object.entries(HEADER_PATTERNS)) {
			const m = line.match(pattern);
			if (m) {
				headers[key] = m[1].trim();
				lastHeaderLine = i;
				currentKey = key;
				matched = true;
				break;
			}
		}

		if (!matched && currentKey && lastHeaderLine === i - 1) {
			headers[currentKey] += ` ${line}`;
			lastHeaderLine = i;
		} else if (!matched && lastHeaderLine >= 0) {
			break;
		}
	}

	if (lastHeaderLine < 0) {
		return { headers, bodyStart: 0 };
	}

	let bodyStart = 0;
	for (let i = 0; i <= lastHeaderLine; i++) {
		bodyStart += lines[i].length + 1;
	}

	const nextContent = text.slice(bodyStart);
	const leadingBlank = nextContent.match(/^\n*/);
	if (leadingBlank) {
		bodyStart += leadingBlank[0].length;
	}

	return { headers, bodyStart };
}

/**
 * 检测邮件是否为"用户转发给我们"的邮件，如果是则解包提取原始信息。
 *
 * 智能区分两种情况：
 * 1. 用户把企业邮箱的邮件转发到 163/Flowmail → 需要解包（发件人≠原始发件人）
 * 2. 邮件本身就是转发链中的一环（比如对方发的就是 Fwd: 邮件）→ 不解包
 *
 * 对正常邮件零影响——不满足条件直接返回 { isForwarded: false }。
 */
export function unwrapForwardedEmail(input: {
	subject: string;
	sender: string;
	senderEmail: string;
	content: string;
	bodyText?: string;
}): UnwrapResult {
	const textToScan = input.bodyText || input.content || "";
	const forwardBlock = findForwardBlock(textToScan);

	if (!forwardBlock) {
		return { isForwarded: false };
	}

	const { headers, bodyStart } = parseForwardHeaders(forwardBlock.afterSeparator);

	if (!headers.from) {
		return { isForwarded: false };
	}

	const parsedOriginal = extractEmail(headers.from);
	const originalEmail = parsedOriginal?.email?.toLowerCase();
	const currentEmail = input.senderEmail.toLowerCase();

	if (!originalEmail || originalEmail === currentEmail) {
		return { isForwarded: false };
	}

	const result: UnwrapResult = {
		isForwarded: true,
		forwarder: input.sender,
		forwarderEmail: input.senderEmail,
	};

	result.originalSender = parsedOriginal.email;
	result.originalSenderName = parsedOriginal.name;

	if (headers.subject) {
		result.originalSubject = headers.subject;
	} else {
		const subjectIsForward = FORWARD_SUBJECT_RE.test(input.subject);
		if (subjectIsForward) {
			result.originalSubject = input.subject.replace(FORWARD_SUBJECT_RE, "").trim();
		}
	}

	if (headers.date) {
		result.originalDate = headers.date;
	}

	if (headers.to) {
		result.originalTo = headers.to;
	}

	const cleanBody = forwardBlock.afterSeparator.slice(bodyStart).trim();
	if (cleanBody) {
		result.cleanBody = cleanBody;
	}

	return result;
}
