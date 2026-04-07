"use client";

import { AnimatedBeam } from "@repo/ui/components/animated-beam";
import { MagicCard } from "@repo/ui/components/magic-card";
import { NumberTicker } from "@repo/ui/components/number-ticker";
import {
	Terminal,
	TypingAnimation,
	AnimatedSpan,
} from "@repo/ui/components/terminal";
import { NoiseBackground } from "@repo/ui/components/ui/noise-background";
import ColourfulText from "@repo/ui/components/ui/colourful-text";
import { BlurFade } from "@repo/ui/components/blur-fade";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import {
	AlertTriangleIcon,
	BotIcon,
	CalendarIcon,
	CheckCircle2Icon,
	CpuIcon,
	FileTextIcon,
	InboxIcon,
	MailIcon,
	XCircleIcon,
	ZapIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// 1. InboxVisual
// ---------------------------------------------------------------------------

const inboxMeta = [
	{ fromKey: "inbox1from", subjectKey: "inbox1subject", tagKey: "tagApproval", color: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle2Icon, gradientFrom: "#22c55e", gradientTo: "#4ade80" },
	{ fromKey: "inbox2from", subjectKey: "inbox2subject", tagKey: "tagReport", color: "text-blue-500", bg: "bg-blue-500/10", icon: FileTextIcon, gradientFrom: "#3b82f6", gradientTo: "#60a5fa" },
	{ fromKey: "inbox3from", subjectKey: "inbox3subject", tagKey: "tagIssue", color: "text-orange-500", bg: "bg-orange-500/10", icon: AlertTriangleIcon, gradientFrom: "#f97316", gradientTo: "#fb923c" },
	{ fromKey: "inbox4from", subjectKey: "inbox4subject", tagKey: "tagApproval", color: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle2Icon, gradientFrom: "#22c55e", gradientTo: "#4ade80" },
] as const;

export function InboxVisual() {
	const t = useTranslations("features.demo");
	const [visibleCount, setVisibleCount] = useState(0);
	const [classified, setClassified] = useState<boolean[]>([]);

	useEffect(() => {
		if (visibleCount >= inboxMeta.length) {
			return;
		}
		const timer = setTimeout(() => {
			setVisibleCount((c) => c + 1);
		}, 1000);
		return () => clearTimeout(timer);
	}, [visibleCount]);

	useEffect(() => {
		if (classified.length >= visibleCount) {
			return;
		}
		const timer = setTimeout(() => {
			setClassified((c) => [...c, true]);
		}, 700);
		return () => clearTimeout(timer);
	}, [visibleCount, classified.length]);

	return (
		<NoiseBackground
			containerClassName="w-full rounded-2xl p-1"
			gradientColors={["rgb(59,130,246)", "rgb(139,92,246)", "rgb(236,72,153)"]}
			noiseIntensity={0.06}
			speed={0.04}
		>
			<div className="relative w-full overflow-hidden rounded-xl bg-background/95 backdrop-blur-sm border p-4">
				<div className="flex items-center justify-between mb-4">
					<span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
						<InboxIcon className="h-3.5 w-3.5" />
						{t("incoming")}
					</span>
					<span className="flex items-center gap-1 text-[10px] text-green-500 font-medium">
						<span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
						{t("classifying")}
					</span>
				</div>

				<div className="space-y-2.5">
					<AnimatePresence>
						{inboxMeta.slice(0, visibleCount).map((item, i) => {
							const isClassified = i < classified.length;
							const Icon = item.icon;
							return (
								<motion.div
									key={`inbox-${i}`}
									initial={{ opacity: 0, y: 20, scale: 0.95 }}
									animate={{ opacity: 1, y: 0, scale: 1 }}
									transition={{ type: "spring", stiffness: 300, damping: 30 }}
								>
									<MagicCard
										className="rounded-xl p-3.5"
										gradientFrom={isClassified ? item.gradientFrom : "#666"}
										gradientTo={isClassified ? item.gradientTo : "#888"}
										gradientOpacity={isClassified ? 0.5 : 0.2}
									>
										<div className="flex items-center gap-3">
											<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/5">
												<AnimatePresence mode="wait">
													{isClassified ? (
														<motion.div
															key="classified"
															initial={{ scale: 0, rotate: -90 }}
															animate={{ scale: 1, rotate: 0 }}
															transition={{ type: "spring", stiffness: 400, damping: 15 }}
														>
															<Icon className={`h-4 w-4 ${item.color}`} />
														</motion.div>
													) : (
														<motion.div key="raw" exit={{ scale: 0, rotate: 90 }}>
															<MailIcon className="h-4 w-4 text-foreground/30" />
														</motion.div>
													)}
												</AnimatePresence>
											</div>
											<div className="min-w-0 flex-1">
												<p className="text-[11px] text-foreground/40 truncate">{t(item.fromKey)}</p>
												<p className="text-sm font-medium text-foreground truncate">{t(item.subjectKey)}</p>
											</div>
											<AnimatePresence>
												{isClassified && (
													<motion.span
														initial={{ opacity: 0, scale: 0.5, x: 20 }}
														animate={{ opacity: 1, scale: 1, x: 0 }}
														transition={{ type: "spring", stiffness: 400, damping: 20 }}
														className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${item.bg} ${item.color} shrink-0`}
													>
														{t(item.tagKey)}
													</motion.span>
												)}
											</AnimatePresence>
										</div>
									</MagicCard>
								</motion.div>
							);
						})}
					</AnimatePresence>
				</div>

				{visibleCount > 0 && visibleCount <= inboxMeta.length && (
					<div className="flex justify-center mt-4">
						<NoiseBackground
							containerClassName="rounded-full p-0.5"
							gradientColors={["rgb(139,92,246)", "rgb(59,130,246)", "rgb(236,72,153)"]}
							noiseIntensity={0.12}
							speed={0.1}
						>
							<motion.div
								className="rounded-full bg-background px-4 py-1.5 flex items-center gap-2"
								animate={{ scale: [1, 1.03, 1] }}
								transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
							>
								<CpuIcon className="h-3.5 w-3.5 text-primary" />
								<span className="text-xs font-bold text-foreground/80">
									{t("aiClassifying")}
								</span>
								<span className="flex gap-0.5">
									{[0, 1, 2].map((d) => (
										<motion.span
											key={d}
											className="h-1 w-1 rounded-full bg-primary"
											animate={{ opacity: [0.3, 1, 0.3] }}
											transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, delay: d * 0.2 }}
										/>
									))}
								</span>
							</motion.div>
						</NoiseBackground>
					</div>
				)}
			</div>
		</NoiseBackground>
	);
}

// ---------------------------------------------------------------------------
// 2. ActionsVisual
// ---------------------------------------------------------------------------

type ExecItem = {
	lucideIcon?: LucideIcon;
	logoSrc?: string;
	labelKey: string;
	gradientFrom: string;
	gradientTo: string;
};

function ExecItemIcon({ item }: { item: ExecItem }) {
	if (item.logoSrc) {
		return (
			<Image
				src={item.logoSrc}
				alt=""
				width={16}
				height={16}
				className="h-4 w-4 shrink-0"
			/>
		);
	}
	if (item.lucideIcon) {
		const Icon = item.lucideIcon;
		return <Icon className="h-4 w-4 text-foreground/50 shrink-0" />;
	}
	return null;
}

export function ActionsVisual() {
	const t = useTranslations("features.demo");
	const locale = useLocale();
	const [phase, setPhase] = useState(0);

	useEffect(() => {
		const timers = [
			setTimeout(() => setPhase(1), 800),
			setTimeout(() => setPhase(2), 2500),
			setTimeout(() => setPhase(3), 3200),
			setTimeout(() => setPhase(0), 8000),
		];
		return () => timers.forEach(clearTimeout);
	}, [phase === 0 ? Date.now() : 0]);

	const executionItems: ExecItem[] =
		locale === "zh"
			? [
					{ logoSrc: "/icons/integrations/gmail.svg", labelKey: "execEmail", gradientFrom: "#3b82f6", gradientTo: "#60a5fa" },
					{ logoSrc: "/icons/integrations/google-calendar.svg", labelKey: "execCalendar", gradientFrom: "#8b5cf6", gradientTo: "#a78bfa" },
					{ logoSrc: "/icons/integrations/feishu.svg", labelKey: "execSlack", gradientFrom: "#00d6b9", gradientTo: "#3370ff" },
				]
			: [
					{ logoSrc: "/icons/integrations/gmail.svg", labelKey: "execEmail", gradientFrom: "#3b82f6", gradientTo: "#60a5fa" },
					{ logoSrc: "/icons/integrations/google-calendar.svg", labelKey: "execCalendar", gradientFrom: "#8b5cf6", gradientTo: "#a78bfa" },
					{ logoSrc: "/icons/integrations/slack.svg", labelKey: "execSlack", gradientFrom: "#f59e0b", gradientTo: "#fbbf24" },
				];

	return (
		<div className="w-full overflow-hidden rounded-2xl bg-muted/30 border p-5 md:p-6">
			<MagicCard
				className="rounded-xl p-4"
				gradientFrom="#22c55e"
				gradientTo="#4ade80"
				gradientOpacity={0.5}
			>
				<div className="flex items-center gap-4">
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium text-foreground">{t("approvalTitle")}</p>
						<p className="text-[11px] text-foreground/40 mt-0.5">{t("approvalFrom")}</p>
					</div>
					<div className="text-right shrink-0">
						<p className="text-sm font-semibold text-foreground">
							$<NumberTicker value={24500} />
						</p>
						<span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-red-500 bg-red-500/10">
							{t("approvalUrgency")}
						</span>
					</div>
					<div className="shrink-0">
						<AnimatePresence mode="wait">
							{phase < 2 ? (
								<motion.div
									key="buttons"
									className="flex gap-1.5"
									exit={{ opacity: 0, scale: 0.8 }}
								>
									<motion.button
										type="button"
										className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 transition-colors"
										animate={phase >= 1 ? {
											scale: [1, 1.15, 1],
											boxShadow: ["0 0 0 0 rgba(34,197,94,0)", "0 0 0 6px rgba(34,197,94,0.3)", "0 0 0 0 rgba(34,197,94,0)"],
										} : {}}
										transition={{ duration: 1, repeat: phase >= 1 ? Number.POSITIVE_INFINITY : 0 }}
									>
										<CheckCircle2Icon className="h-4 w-4 text-green-500" />
									</motion.button>
									<button
										type="button"
										className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10"
									>
										<XCircleIcon className="h-4 w-4 text-red-500" />
									</button>
								</motion.div>
							) : (
								<motion.div
									key="approved"
									initial={{ opacity: 0, scale: 0.5 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{ type: "spring", stiffness: 400, damping: 20 }}
									className="flex items-center gap-1 text-green-500 font-medium text-sm"
								>
									<CheckCircle2Icon className="h-4 w-4" />
									{t("approved")}
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			</MagicCard>

			<AnimatePresence>
				{phase >= 3 && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						transition={{ duration: 0.4, ease: "easeOut" }}
						className="mt-4 space-y-2"
					>
						<div className="flex items-center justify-center gap-1 mb-3">
							<ZapIcon className="h-3 w-3 text-primary" />
							<span className="text-[10px] text-foreground/40 uppercase tracking-wider font-medium">{t("executing")}</span>
						</div>
						{executionItems.map((item, i) => (
							<motion.div
								key={item.labelKey}
								initial={{ opacity: 0, y: 20, scale: 0.9 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								transition={{ delay: i * 0.25, type: "spring", stiffness: 300, damping: 25 }}
							>
								<MagicCard
									className="rounded-lg p-3"
									gradientFrom={item.gradientFrom}
									gradientTo={item.gradientTo}
									gradientOpacity={0.4}
								>
									<div className="flex items-center gap-3">
										<motion.div
											initial={{ scale: 0 }}
											animate={{ scale: 1 }}
											transition={{ delay: i * 0.25 + 0.3, type: "spring", stiffness: 500, damping: 15 }}
											className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/10"
										>
											<CheckCircle2Icon className="h-3 w-3 text-green-500" />
										</motion.div>
										<ExecItemIcon item={item} />
										<span className="text-sm text-foreground truncate">{t(item.labelKey)}</span>
									</div>
								</MagicCard>
							</motion.div>
						))}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 1 }}
							className="pt-2 text-center text-xs font-semibold"
						>
							<ColourfulText text={t("execSummary")} />
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

// ---------------------------------------------------------------------------
// 3. InsightsVisual
// ---------------------------------------------------------------------------

export function InsightsVisual() {
	const t = useTranslations("features.demo");

	return (
		<div className="space-y-4">
			<Terminal className="w-full max-w-full">
				<TypingAnimation>{t("terminalCmd")}</TypingAnimation>
				<AnimatedSpan delay={100} className="text-muted-foreground">
					<span>{t("terminalReading")}</span>
				</AnimatedSpan>
				<AnimatedSpan delay={200} className="text-muted-foreground">
					<span>{t("terminalExtracting")}</span>
				</AnimatedSpan>
				<AnimatedSpan delay={300} className="text-green-500">
					<span>{t("terminalStatus")}</span>
				</AnimatedSpan>
				<AnimatedSpan delay={400} className="text-green-500">
					<span>{t("terminalBlockers")}</span>
				</AnimatedSpan>
				<AnimatedSpan delay={500} className="text-green-500">
					<span>{t("terminalNextSteps")}</span>
				</AnimatedSpan>
				<AnimatedSpan delay={600} className="text-muted-foreground">
					<span>{t("terminalCreating")}</span>
				</AnimatedSpan>
				<AnimatedSpan delay={700} className="text-blue-500">
					<span>{t("terminalTask1")}</span>
				</AnimatedSpan>
				<AnimatedSpan delay={800} className="text-blue-500">
					<span>{t("terminalTask2")}</span>
				</AnimatedSpan>
				<AnimatedSpan delay={900} className="text-blue-500">
					<span>{t("terminalTask3")}</span>
				</AnimatedSpan>
				<AnimatedSpan delay={1000} className="text-primary font-semibold">
					<span>{t("terminalDone")}</span>
				</AnimatedSpan>
			</Terminal>

			<BlurFade delay={1.2} inView>
				<div className="grid grid-cols-2 gap-3">
					<MagicCard className="rounded-xl p-4" gradientOpacity={0.4}>
						<p className="text-[11px] text-foreground/50 uppercase tracking-wider font-medium mb-1">
							{t("reportsProcessed")}
						</p>
						<div className="text-2xl font-semibold text-foreground">
							<NumberTicker value={342} />
						</div>
					</MagicCard>
					<MagicCard className="rounded-xl p-4" gradientFrom="#22c55e" gradientTo="#16a34a" gradientOpacity={0.4}>
						<p className="text-[11px] text-foreground/50 uppercase tracking-wider font-medium mb-1">
							{t("onTrack")}
						</p>
						<div className="text-2xl font-semibold text-green-500">
							<NumberTicker value={87} /><span>%</span>
						</div>
					</MagicCard>
					<MagicCard className="rounded-xl p-4" gradientFrom="#f97316" gradientTo="#ea580c" gradientOpacity={0.4}>
						<p className="text-[11px] text-foreground/50 uppercase tracking-wider font-medium mb-1">
							{t("blockersFound")}
						</p>
						<div className="text-2xl font-semibold text-orange-500">
							<NumberTicker value={18} />
						</div>
					</MagicCard>
					<MagicCard className="rounded-xl p-4" gradientFrom="#3b82f6" gradientTo="#2563eb" gradientOpacity={0.4}>
						<p className="text-[11px] text-foreground/50 uppercase tracking-wider font-medium mb-1">
							{t("tasksCreated")}
						</p>
						<div className="text-2xl font-semibold text-blue-500">
							<NumberTicker value={156} />
						</div>
					</MagicCard>
				</div>
			</BlurFade>
		</div>
	);
}

// ---------------------------------------------------------------------------
// 4. AgentsVisual
// ---------------------------------------------------------------------------

type AgentNode = {
	nameKey: string;
	logoSrc?: string;
	lucideIcon?: LucideIcon;
	invertDark?: boolean;
};

type ExecNode = {
	nameKey: string;
	lucideIcon?: LucideIcon;
	logoSrc?: string;
};

const agentNodesEn: AgentNode[] = [
	{ nameKey: "agent1", logoSrc: "/icons/integrations/claude.svg" },
	{ nameKey: "agent2", logoSrc: "/icons/integrations/cursor.svg", invertDark: true },
	{ nameKey: "agent3", logoSrc: "/icons/integrations/openclaw.svg", invertDark: true },
];

const agentNodesZh: AgentNode[] = [
	{ nameKey: "agent1", logoSrc: "/icons/integrations/claude.svg" },
	{ nameKey: "agent2", lucideIcon: BotIcon },
	{ nameKey: "agent3", logoSrc: "/icons/integrations/openclaw.svg", invertDark: true },
];

const execNodesEn: ExecNode[] = [
	{ nameKey: "exec1", logoSrc: "/icons/integrations/gmail.svg" },
	{ nameKey: "exec2", logoSrc: "/icons/integrations/google-calendar.svg" },
	{ nameKey: "exec3", logoSrc: "/icons/integrations/linear.svg" },
	{ nameKey: "exec4", logoSrc: "/icons/integrations/slack.svg" },
];

const execNodesZh: ExecNode[] = [
	{ nameKey: "exec1", lucideIcon: MailIcon },
	{ nameKey: "exec2", lucideIcon: CalendarIcon },
	{ nameKey: "exec3", logoSrc: "/icons/integrations/feishu.svg" },
	{ nameKey: "exec4", logoSrc: "/icons/integrations/dingtalk.svg" },
];

const actionKeys = ["action1", "action2", "action3", "action4"] as const;

export function AgentsVisual() {
	const t = useTranslations("features.demo");
	const locale = useLocale();
	const containerRef = useRef<HTMLDivElement>(null);
	const agent1Ref = useRef<HTMLDivElement>(null);
	const agent2Ref = useRef<HTMLDivElement>(null);
	const agent3Ref = useRef<HTMLDivElement>(null);
	const hubRef = useRef<HTMLDivElement>(null);
	const exec1Ref = useRef<HTMLDivElement>(null);
	const exec2Ref = useRef<HTMLDivElement>(null);
	const exec3Ref = useRef<HTMLDivElement>(null);
	const exec4Ref = useRef<HTMLDivElement>(null);
	const agentRefs = [agent1Ref, agent2Ref, agent3Ref];
	const execRefs = [exec1Ref, exec2Ref, exec3Ref, exec4Ref];

	const agentNodes = locale === "zh" ? agentNodesZh : agentNodesEn;
	const executionNodes = locale === "zh" ? execNodesZh : execNodesEn;

	const [actionIndex, setActionIndex] = useState(0);
	useEffect(() => {
		const interval = setInterval(() => {
			setActionIndex((i) => (i + 1) % actionKeys.length);
		}, 2500);
		return () => clearInterval(interval);
	}, []);

	return (
		<div
			ref={containerRef}
			className="relative flex h-80 md:h-96 w-full items-center justify-center overflow-hidden rounded-2xl bg-muted/50 border p-6"
		>
			<div className="flex items-center justify-between w-full max-w-lg">
				<div className="flex flex-col items-start gap-5">
					{agentNodes.map((agent, i) => (
						<div key={agent.nameKey} className="flex items-center gap-2">
							<MagicCard className="rounded-full p-0" gradientOpacity={0.3}>
							<div
								ref={agentRefs[i]}
									className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-background p-2.5"
							>
									{agent.logoSrc ? (
								<Image
											src={agent.logoSrc}
											alt={t(agent.nameKey)}
									width={20}
									height={20}
											className={`h-5 w-5 ${agent.invertDark ? "dark:invert" : ""}`}
										/>
									) : agent.lucideIcon ? (
										(() => {
											const Icon = agent.lucideIcon;
											return <Icon className="h-5 w-5 text-foreground/70" />;
										})()
									) : null}
							</div>
							</MagicCard>
							<span className="text-[11px] text-foreground/50 font-medium hidden md:block">
								{t(agent.nameKey)}
							</span>
						</div>
					))}
				</div>

				<div className="flex flex-col items-center gap-1.5">
					<NoiseBackground
						containerClassName="rounded-full p-1"
						gradientColors={["rgb(99,102,241)", "rgb(168,85,247)", "rgb(236,72,153)"]}
						noiseIntensity={0.08}
						speed={0.06}
					>
						<motion.div
							ref={hubRef}
							className="relative z-10 flex h-18 w-18 items-center justify-center rounded-full bg-background"
							animate={{ scale: [1, 1.06, 1] }}
							transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
					>
						<Image
								src="/logo-dark.png"
								alt="Flowmail"
								width={40}
								height={40}
								className="h-10 w-10 block dark:hidden"
							/>
							<Image
								src="/logo-light.png"
								alt="Flowmail"
								width={40}
								height={40}
								className="h-10 w-10 hidden dark:block"
							/>
						</motion.div>
					</NoiseBackground>
					<span className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">
						Flowmail
					</span>
					<span className="text-[9px] text-foreground/40 font-medium">
						{t("mcpServer")}
					</span>
				</div>

				<div className="flex flex-col items-end gap-5">
					{executionNodes.map((node, i) => (
						<div key={node.nameKey} className="flex items-center gap-2">
							<span className="text-[11px] text-foreground/50 font-medium hidden md:block">
								{t(node.nameKey)}
							</span>
							<MagicCard
								className="rounded-full p-0"
								gradientFrom="#22c55e"
								gradientTo="#4ade80"
								gradientOpacity={0.3}
							>
								<div
									ref={execRefs[i]}
									className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background"
								>
									{node.logoSrc ? (
										<Image
											src={node.logoSrc}
											alt={t(node.nameKey)}
											width={16}
											height={16}
											className="h-4 w-4"
										/>
									) : node.lucideIcon ? (
										(() => {
											const Icon = node.lucideIcon;
											return <Icon className="h-4 w-4 text-foreground/60" />;
										})()
									) : null}
								</div>
							</MagicCard>
					</div>
					))}
				</div>
			</div>

			{agentRefs.map((ref, i) => (
				<AnimatedBeam
					key={`beam-l-${i}`}
					containerRef={containerRef}
					fromRef={ref}
					toRef={hubRef}
					curvature={i === 0 ? -20 : i === 2 ? 20 : 0}
					startXOffset={22}
					endXOffset={-36}
					pathWidth={1.5}
					pathOpacity={0.1}
					duration={3.5 + i * 0.4}
				/>
			))}
			{agentRefs.map((ref, i) => (
				<AnimatedBeam
					key={`beam-lr-${i}`}
					containerRef={containerRef}
					fromRef={ref}
					toRef={hubRef}
					curvature={i === 0 ? -20 : i === 2 ? 20 : 0}
					startXOffset={22}
					endXOffset={-36}
					pathWidth={1.5}
					pathOpacity={0}
					reverse
					gradientStartColor="#818cf8"
					gradientStopColor="#c084fc"
					duration={4 + i * 0.4}
					delay={1.5}
				/>
			))}

			{execRefs.map((ref, i) => {
				const curvatures = [-12, -4, 4, 12];
				return (
			<AnimatedBeam
						key={`beam-r-${i}`}
				containerRef={containerRef}
						fromRef={hubRef}
						toRef={ref}
						curvature={curvatures[i]}
						startXOffset={36}
						endXOffset={-20}
				pathWidth={1.5}
						pathOpacity={0.1}
				gradientStartColor="#22c55e"
				gradientStopColor="#4ade80"
						duration={3.5 + i * 0.3}
						delay={0.5}
			/>
				);
			})}

			<div className="absolute bottom-3 left-1/2 -translate-x-1/2">
				<div className="flex items-center gap-2 rounded-full bg-background border px-3 py-1.5 shadow-sm min-w-[260px] justify-center">
					<CpuIcon className="h-3 w-3 text-primary shrink-0" />
					<AnimatePresence mode="wait">
						<motion.span
							key={actionIndex}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -8 }}
							transition={{ duration: 0.3 }}
							className="text-[11px] font-medium"
						>
							<ColourfulText text={t(actionKeys[actionIndex])} />
						</motion.span>
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}
