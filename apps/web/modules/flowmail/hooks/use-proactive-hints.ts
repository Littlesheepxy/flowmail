"use client";

import { useAiEyes } from "@ai-eyes/react";
import type { HelpSuggestion } from "@ai-eyes/core";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface HintRule {
	id: string;
	match: (ctx: HintContext) => boolean;
	delay: number;
	message: string;
	suggestedAction?: string;
	suggestedMessage?: string;
	/** Only fire once per session (per route). */
	once?: boolean;
}

interface HintContext {
	pathname: string;
	hasEntities: boolean;
	hasConnections: boolean;
	isEmptyInbox: boolean;
	entityCount: number;
	connectionCount: number;
	isDemoMode: boolean;
	isPlatformOAuthOpen: boolean;
	secondsOnPage: number;
}

const HINT_RULES: HintRule[] = [
	{
		id: "connections-empty",
		match: (ctx) =>
			ctx.pathname.includes("/connections") &&
			ctx.connectionCount === 0 &&
			ctx.secondsOnPage >= 5,
		delay: 5000,
		message: "还没有连接邮箱？试试直接转发一封邮件到 Flowmail，10 秒就能看到效果",
		suggestedAction: "open-forward-guide",
		suggestedMessage: "教我怎么做",
		once: true,
	},
	{
		id: "connections-stall",
		match: (ctx) =>
			ctx.pathname.includes("/connections") &&
			ctx.connectionCount === 0 &&
			ctx.secondsOnPage >= 20,
		delay: 20000,
		message: "如果你的邮箱是 Gmail 或 Outlook，可以一键 OAuth 连接，无需配置",
		suggestedAction: "open-oauth",
		once: true,
	},
	{
		id: "platform-oauth-help",
		match: (ctx) =>
			ctx.isPlatformOAuthOpen &&
			ctx.secondsOnPage >= 10,
		delay: 10000,
		message: "需要帮你打开开放平台创建应用吗？也可以复制话术发给 IT 同事帮忙。",
		suggestedAction: "open-chat",
		suggestedMessage: "帮我设置高级接入",
		once: true,
	},
	{
		id: "inbox-empty",
		match: (ctx) =>
			ctx.pathname.includes("/inbox") &&
			ctx.isEmptyInbox &&
			!ctx.isDemoMode &&
			ctx.secondsOnPage >= 6,
		delay: 6000,
		message: "收件箱空空如也？你可以生成一些演示数据，快速体验 Flowmail 的核心功能",
		suggestedAction: "generate-demo",
		suggestedMessage: "生成演示数据",
		once: true,
	},
	{
		id: "inbox-demo-explore",
		match: (ctx) =>
			ctx.pathname.includes("/inbox") &&
			ctx.isDemoMode &&
			ctx.entityCount > 0 &&
			ctx.secondsOnPage >= 10,
		delay: 10000,
		message: "点击左侧的任意事项卡片，查看 AI 自动提取的结构化信息和时间线",
		suggestedAction: "guide-click-entity",
		once: true,
	},
	{
		id: "entity-idle",
		match: (ctx) =>
			ctx.pathname.includes("/entity/") &&
			ctx.secondsOnPage >= 12,
		delay: 12000,
		message: "试试切换「动态」和「待办」标签，查看 AI 为这个事项提取的操作建议",
		suggestedAction: "guide-tabs",
		once: true,
	},
	{
		id: "approvals-empty",
		match: (ctx) =>
			ctx.pathname.includes("/approvals") &&
			ctx.entityCount === 0 &&
			ctx.secondsOnPage >= 5,
		delay: 5000,
		message: "还没有审批事项？当邮件中包含审批请求时，Flowmail 会自动识别并创建",
		once: true,
	},
	{
		id: "reports-empty",
		match: (ctx) =>
			ctx.pathname.includes("/reports") &&
			ctx.entityCount === 0 &&
			ctx.secondsOnPage >= 5,
		delay: 5000,
		message: "还没有汇报记录？转发一封周报或进展邮件，AI 会自动提取进展和风险",
		once: true,
	},
	{
		id: "settings-idle",
		match: (ctx) =>
			ctx.pathname.includes("/settings") &&
			ctx.secondsOnPage >= 15,
		delay: 15000,
		message: "需要帮助配置吗？可以点击我随时提问",
		suggestedAction: "open-chat",
		once: true,
	},
];

const SESSION_KEY = "flowmail-hint-shown";

function getShownHints(): Set<string> {
	try {
		const raw = sessionStorage.getItem(SESSION_KEY);
		return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
	} catch {
		return new Set();
	}
}

function markHintShown(id: string) {
	try {
		const shown = getShownHints();
		shown.add(id);
		sessionStorage.setItem(SESSION_KEY, JSON.stringify([...shown]));
	} catch {
		/* noop */
	}
}

export interface ProactiveHintContext {
	hasEntities?: boolean;
	hasConnections?: boolean;
	isEmptyInbox?: boolean;
	entityCount?: number;
	connectionCount?: number;
	isDemoMode?: boolean;
	isPlatformOAuthOpen?: boolean;
}

export function useProactiveHints(appContext: ProactiveHintContext = {}) {
	const pathname = usePathname();
	const { activeSuggestion, setActiveSuggestion, setMood, panelOpen } = useAiEyes();
	const [pageEnteredAt, setPageEnteredAt] = useState(Date.now());
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
	const lastPathnameRef = useRef(pathname);
	const appContextRef = useRef(appContext);
	appContextRef.current = appContext;

	useEffect(() => {
		if (pathname !== lastPathnameRef.current) {
			lastPathnameRef.current = pathname;
			setPageEnteredAt(Date.now());
		}
	}, [pathname]);

	const showHint = useCallback(
		(rule: HintRule) => {
			if (activeSuggestion || panelOpen) {
				return;
			}

			const hint: HelpSuggestion = {
				shouldHelp: true,
				message: rule.message,
				suggestedAction: rule.suggestedAction,
				suggestedMessage: rule.suggestedMessage,
				confidence: 0.8,
			};
			setMood("alert");
			setActiveSuggestion(hint);

			if (rule.once) {
				markHintShown(rule.id);
			}
		},
		[activeSuggestion, panelOpen, setActiveSuggestion, setMood],
	);

	useEffect(() => {
		for (const t of timersRef.current) {
			clearTimeout(t);
		}
		timersRef.current = [];

		const shown = getShownHints();

		for (const rule of HINT_RULES) {
			if (rule.once && shown.has(rule.id)) {
				continue;
			}

			const timer = setTimeout(() => {
				const ctx: HintContext = {
					pathname,
					hasEntities: appContextRef.current.hasEntities ?? false,
					hasConnections: appContextRef.current.hasConnections ?? false,
					isEmptyInbox: appContextRef.current.isEmptyInbox ?? false,
					entityCount: appContextRef.current.entityCount ?? 0,
					connectionCount: appContextRef.current.connectionCount ?? 0,
					isDemoMode: appContextRef.current.isDemoMode ?? false,
					isPlatformOAuthOpen: appContextRef.current.isPlatformOAuthOpen ?? false,
					secondsOnPage: Math.floor((Date.now() - pageEnteredAt) / 1000),
				};

				if (rule.match(ctx)) {
					showHint(rule);
				}
			}, rule.delay);

			timersRef.current.push(timer);
		}

		return () => {
			for (const t of timersRef.current) {
				clearTimeout(t);
			}
			timersRef.current = [];
		};
	}, [pathname, pageEnteredAt, showHint]);
}
