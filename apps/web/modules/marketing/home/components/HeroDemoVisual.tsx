"use client";

import { MagicCard } from "@repo/ui/components/magic-card";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	CpuIcon,
	FileTextIcon,
	InboxIcon,
	MailIcon,
	XCircleIcon,
	ZapIcon,
} from "lucide-react";
import Image from "next/image";

const emailMeta = [
	{
		fromKey: "inbox1from",
		subjectKey: "inbox1subject",
		tagKey: "tagApproval",
		color: "text-green-500",
		bg: "bg-green-500/10",
		icon: CheckCircle2Icon,
		gradientFrom: "#22c55e",
		gradientTo: "#4ade80",
	},
	{
		fromKey: "inbox2from",
		subjectKey: "inbox2subject",
		tagKey: "tagReport",
		color: "text-blue-500",
		bg: "bg-blue-500/10",
		icon: FileTextIcon,
		gradientFrom: "#3b82f6",
		gradientTo: "#60a5fa",
	},
	{
		fromKey: "inbox3from",
		subjectKey: "inbox3subject",
		tagKey: "tagIssue",
		color: "text-orange-500",
		bg: "bg-orange-500/10",
		icon: AlertTriangleIcon,
		gradientFrom: "#f97316",
		gradientTo: "#fb923c",
	},
] as const;

type ExecItem = {
	logoSrc: string;
	labelKey: string;
};

export function HeroDemoVisual() {
	const t = useTranslations("features.demo");
	const locale = useLocale();
	const [phase, setPhase] = useState<
		"incoming" | "classifying" | "approval" | "executing" | "done"
	>("incoming");
	const [visibleEmails, setVisibleEmails] = useState(0);
	const [classifiedCount, setClassifiedCount] = useState(0);
	const [approvalState, setApprovalState] = useState<
		"pending" | "hovering" | "approved"
	>("pending");
	const [execVisible, setExecVisible] = useState(0);

	const executionItems: ExecItem[] =
		locale === "zh"
			? [
					{ logoSrc: "/icons/integrations/gmail.svg", labelKey: "execEmail" },
					{
						logoSrc: "/icons/integrations/google-calendar.svg",
						labelKey: "execCalendar",
					},
					{
						logoSrc: "/icons/integrations/feishu.svg",
						labelKey: "execSlack",
					},
				]
			: [
					{ logoSrc: "/icons/integrations/gmail.svg", labelKey: "execEmail" },
					{
						logoSrc: "/icons/integrations/google-calendar.svg",
						labelKey: "execCalendar",
					},
					{
						logoSrc: "/icons/integrations/slack.svg",
						labelKey: "execSlack",
					},
				];

	useEffect(() => {
		const run = async () => {
			setPhase("incoming");
			setVisibleEmails(0);
			setClassifiedCount(0);
			setApprovalState("pending");
			setExecVisible(0);

			await delay(600);
			setVisibleEmails(1);
			await delay(700);
			setVisibleEmails(2);
			await delay(700);
			setVisibleEmails(3);

			setPhase("classifying");
			await delay(600);
			setClassifiedCount(1);
			await delay(500);
			setClassifiedCount(2);
			await delay(500);
			setClassifiedCount(3);

			setPhase("approval");
			await delay(800);
			setApprovalState("hovering");
			await delay(1200);
			setApprovalState("approved");

			setPhase("executing");
			await delay(600);
			setExecVisible(1);
			await delay(400);
			setExecVisible(2);
			await delay(400);
			setExecVisible(3);

			setPhase("done");
			await delay(3000);
		};

		run();
		const interval = setInterval(run, 14000);
		return () => clearInterval(interval);
	}, []);

	const showExec = phase === "executing" || phase === "done";

	return (
		<div className="w-full max-w-md mx-auto lg:mx-0">
			{/* Fixed-height outer wrapper — matches the fully expanded state */}
			<div className="rounded-2xl border bg-background/80 backdrop-blur-sm shadow-2xl overflow-hidden min-h-[420px] flex flex-col">
				{/* Header bar */}
				<div className="flex items-center justify-between border-b px-4 py-2.5 bg-muted/30 shrink-0">
					<span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
						<InboxIcon className="h-3.5 w-3.5" />
						{t("incoming")}
					</span>
					<span className="flex items-center gap-1 text-[10px] text-green-500 font-medium">
						<span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
						{phase === "classifying" ? t("classifying") : "Live"}
					</span>
				</div>

				{/* Scrollable content area with fixed height */}
				<div className="flex-1 flex flex-col">
					{/* Email list — always reserves space for 3 rows */}
					<div className="p-3 space-y-2">
						{emailMeta.map((item, i) => {
							const isVisible = i < visibleEmails;
							const isClassified = i < classifiedCount;
							const Icon = item.icon;
							const isApprovalRow = i === 0;
							const showApprovalButtons =
								isApprovalRow &&
								isClassified &&
								phase !== "incoming" &&
								phase !== "classifying";

							return (
								<motion.div
									key={`email-${i}`}
									animate={{
										opacity: isVisible ? 1 : 0,
										y: isVisible ? 0 : 10,
										scale: isVisible ? 1 : 0.97,
									}}
									transition={{
										type: "spring",
										stiffness: 300,
										damping: 30,
									}}
								>
									<MagicCard
										className="rounded-lg p-3"
										gradientFrom={
											isClassified ? item.gradientFrom : "#666"
										}
										gradientTo={
											isClassified ? item.gradientTo : "#888"
										}
										gradientOpacity={isClassified ? 0.4 : 0.15}
									>
										<div className="flex items-center gap-2.5">
											<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/5">
												<AnimatePresence mode="wait">
													{isClassified ? (
														<motion.div
															key="classified"
															initial={{
																scale: 0,
																rotate: -90,
															}}
															animate={{
																scale: 1,
																rotate: 0,
															}}
															transition={{
																type: "spring",
																stiffness: 400,
																damping: 15,
															}}
														>
															<Icon
																className={`h-3.5 w-3.5 ${item.color}`}
															/>
														</motion.div>
													) : (
														<motion.div
															key="raw"
															exit={{
																scale: 0,
																rotate: 90,
															}}
														>
															<MailIcon className="h-3.5 w-3.5 text-foreground/30" />
														</motion.div>
													)}
												</AnimatePresence>
											</div>
											<div className="min-w-0 flex-1">
												<p className="text-[10px] text-foreground/40 truncate">
													{t(item.fromKey)}
												</p>
												<p className="text-xs font-medium text-foreground truncate">
													{t(item.subjectKey)}
												</p>
											</div>
											<div className="flex items-center gap-1.5 shrink-0">
												<AnimatePresence>
													{isClassified && (
														<motion.span
															initial={{
																opacity: 0,
																scale: 0.5,
																x: 10,
															}}
															animate={{
																opacity: 1,
																scale: 1,
																x: 0,
															}}
															transition={{
																type: "spring",
																stiffness: 400,
																damping: 20,
															}}
															className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${item.bg} ${item.color}`}
														>
															{t(item.tagKey)}
														</motion.span>
													)}
												</AnimatePresence>
												{showApprovalButtons && (
													<AnimatePresence mode="wait">
														{approvalState !== "approved" ? (
															<motion.div
																key="buttons"
																className="flex gap-1"
																exit={{
																	opacity: 0,
																	scale: 0.8,
																}}
															>
																<motion.div
																	className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10 cursor-pointer"
																	animate={
																		approvalState ===
																		"hovering"
																			? {
																					scale: [
																						1, 1.2,
																						1,
																					],
																					boxShadow: [
																						"0 0 0 0 rgba(34,197,94,0)",
																						"0 0 0 4px rgba(34,197,94,0.3)",
																						"0 0 0 0 rgba(34,197,94,0)",
																					],
																				}
																			: {}
																	}
																	transition={{
																		duration: 0.8,
																		repeat:
																			approvalState ===
																			"hovering"
																				? Number.POSITIVE_INFINITY
																				: 0,
																	}}
																>
																	<CheckCircle2Icon className="h-3 w-3 text-green-500" />
																</motion.div>
																<div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10">
																	<XCircleIcon className="h-3 w-3 text-red-500" />
																</div>
															</motion.div>
														) : (
															<motion.div
																key="approved"
																initial={{
																	opacity: 0,
																	scale: 0.5,
																}}
																animate={{
																	opacity: 1,
																	scale: 1,
																}}
																transition={{
																	type: "spring",
																	stiffness: 400,
																	damping: 20,
																}}
																className="flex items-center gap-0.5 text-green-500 text-[9px] font-semibold"
															>
																<CheckCircle2Icon className="h-3 w-3" />
																{t("approved")}
															</motion.div>
														)}
													</AnimatePresence>
												)}
											</div>
										</div>
									</MagicCard>
								</motion.div>
							);
						})}
					</div>

					{/* AI classifying indicator — always takes space, visibility toggled */}
					<div className="flex justify-center pb-3 shrink-0">
						<motion.div
							animate={{ opacity: phase === "classifying" ? 1 : 0 }}
							transition={{ duration: 0.2 }}
							className="flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1"
						>
							<CpuIcon className="h-3 w-3 text-primary" />
							<span className="text-[10px] font-semibold text-foreground/70">
								{t("aiClassifying")}
							</span>
							<span className="flex gap-0.5">
								{[0, 1, 2].map((d) => (
									<motion.span
										key={d}
										className="h-1 w-1 rounded-full bg-primary"
										animate={{ opacity: [0.3, 1, 0.3] }}
										transition={{
											duration: 1,
											repeat: Number.POSITIVE_INFINITY,
											delay: d * 0.2,
										}}
									/>
								))}
							</span>
						</motion.div>
					</div>

					{/* Execution chain — always rendered, opacity-controlled */}
					<motion.div
						animate={{ opacity: showExec ? 1 : 0 }}
						transition={{ duration: 0.3 }}
						className="border-t shrink-0"
						aria-hidden={!showExec}
					>
						<div className="px-3 pt-2.5 pb-3">
							<div className="flex items-center gap-1.5 mb-2">
								<ZapIcon className="h-3 w-3 text-primary" />
								<span className="text-[9px] text-foreground/40 uppercase tracking-wider font-medium">
									{t("executing")}
								</span>
							</div>
							<div className="space-y-1.5">
								{executionItems.map((item, i) => {
									const isItemVisible = i < execVisible;
									return (
										<motion.div
											key={item.labelKey}
											animate={{
												opacity: isItemVisible ? 1 : 0,
												x: isItemVisible ? 0 : -10,
											}}
											transition={{
												type: "spring",
												stiffness: 300,
												damping: 25,
											}}
											className="flex items-center gap-2.5 rounded-lg bg-green-500/5 border border-green-500/10 px-2.5 py-1.5"
										>
											<motion.div
												animate={{
													scale: isItemVisible ? 1 : 0,
												}}
												transition={{
													type: "spring",
													stiffness: 500,
													damping: 15,
												}}
											>
												<CheckCircle2Icon className="h-3 w-3 text-green-500" />
											</motion.div>
											<Image
												src={item.logoSrc}
												alt=""
												width={14}
												height={14}
												className="h-3.5 w-3.5"
											/>
											<span className="text-[11px] text-foreground/70">
												{t(item.labelKey)}
											</span>
										</motion.div>
									);
								})}
							</div>
						</div>
					</motion.div>
				</div>
			</div>
		</div>
	);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
