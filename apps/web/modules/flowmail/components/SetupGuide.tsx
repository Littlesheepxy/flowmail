"use client";

import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { useConfetti } from "@shared/hooks/use-confetti";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	BellIcon,
	CheckCircle2Icon,
	ChevronDownIcon,
	InboxIcon,
	MailIcon,
	PartyPopperIcon,
	SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

interface SetupGuideProps {
	collapsed: boolean;
	basePath: string;
}

const STEP_ICONS = [MailIcon, SettingsIcon, InboxIcon, BellIcon] as const;

export function SetupGuide({ collapsed, basePath }: SetupGuideProps) {
	const t = useTranslations("setupGuide");
	const { activeOrganization } = useActiveOrganization();
	const queryClient = useQueryClient();
	const { fire: fireConfetti } = useConfetti();
	const [isExpanded, setIsExpanded] = useState(true);
	const prevCompletedRef = useRef<number | null>(null);

	const { data: guideStatus } = useQuery({
		...orpc.setupGuide.getStatus.queryOptions({
			input: { organizationId: activeOrganization?.id ?? "" },
		}),
		enabled: !!activeOrganization?.id,
		refetchInterval: 10000,
	});

	const dismissMutation = useMutation(
		orpc.setupGuide.dismiss.mutationOptions(),
	);

	const markStepMutation = useMutation(
		orpc.setupGuide.markStep.mutationOptions(),
	);

	const invalidateGuide = useCallback(() => {
		if (!activeOrganization?.id) {
			return;
		}
		queryClient.invalidateQueries({
			queryKey: orpc.setupGuide.getStatus.queryOptions({
				input: { organizationId: activeOrganization.id },
			}).queryKey,
		});
	}, [activeOrganization?.id, queryClient]);

	const allComplete =
		guideStatus?.completedCount === guideStatus?.totalSteps;

	useEffect(() => {
		if (!guideStatus) {
			return;
		}
		if (prevCompletedRef.current === null) {
			prevCompletedRef.current = guideStatus.completedCount;
			return;
		}
		if (
			guideStatus.completedCount === guideStatus.totalSteps &&
			prevCompletedRef.current < guideStatus.totalSteps
		) {
			fireConfetti();
		}
		prevCompletedRef.current = guideStatus.completedCount;
	}, [guideStatus, fireConfetti]);

	if (!guideStatus || guideStatus.dismissed) {
		return null;
	}

	const steps = [
		{
			key: "connectEmail" as const,
			completed: guideStatus.steps.connectEmail,
			href: `${basePath}/connections?guide=connectEmail`,
		},
		{
			key: "configureCategories" as const,
			completed: guideStatus.steps.configureCategories,
			href: `${basePath}/categories?guide=configureCategories`,
		},
		{
			key: "processFirstEmail" as const,
			completed: guideStatus.steps.processFirstEmail,
			href: `${basePath}/inbox?guide=processFirstEmail`,
		},
		{
			key: "checkNotifications" as const,
			completed: guideStatus.steps.checkNotifications,
			href: null,
		},
	];

	const handleNotificationCheck = () => {
		if (!activeOrganization?.id) {
			return;
		}
		markStepMutation.mutate(
			{
				organizationId: activeOrganization.id,
				step: "notificationChecked",
			},
			{ onSuccess: invalidateGuide },
		);
	};

	const handleDismiss = () => {
		if (!activeOrganization?.id) {
			return;
		}
		dismissMutation.mutate(
			{ organizationId: activeOrganization.id },
			{ onSuccess: invalidateGuide },
		);
	};

	const progressPercent =
		(guideStatus.completedCount / guideStatus.totalSteps) * 100;

	if (collapsed) {
		return (
			<TooltipProvider delayDuration={0}>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-colors mx-auto mb-2"
							onClick={() => setIsExpanded(!isExpanded)}
						>
							<svg className="h-6 w-6" viewBox="0 0 36 36" role="img" aria-label="Setup progress">
								<title>Setup progress</title>
								<circle
									cx="18"
									cy="18"
									r="15"
									fill="none"
									className="stroke-white/30"
									strokeWidth="3"
								/>
								<circle
									cx="18"
									cy="18"
									r="15"
									fill="none"
									className="stroke-white"
									strokeWidth="3"
									strokeDasharray={`${progressPercent * 0.9425} 94.25`}
									strokeLinecap="round"
									transform="rotate(-90 18 18)"
								/>
								<text
									x="18"
									y="18"
									textAnchor="middle"
									dominantBaseline="central"
									className="fill-white text-[10px] font-medium"
								>
									{guideStatus.completedCount}
								</text>
							</svg>
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">
						{t("title")} {guideStatus.completedCount}/
						{guideStatus.totalSteps}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	if (allComplete) {
		return (
			<div className="mx-3 mb-2 rounded-xl bg-linear-to-br from-emerald-500/15 to-green-400/10 border border-emerald-500/20 p-3">
				<div className="flex items-center gap-2 mb-1">
					<PartyPopperIcon className="h-4 w-4 text-emerald-500" />
					<span className="text-sm font-medium text-foreground">
						{t("completedTitle")}
					</span>
				</div>
				<p className="text-xs text-foreground/60 mb-2">
					{t("completedMessage")}
				</p>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 w-full text-xs hover:bg-emerald-500/10"
					onClick={handleDismiss}
				>
					{t("dismiss")}
				</Button>
			</div>
		);
	}

	return (
		<div className="mx-3 mb-2 rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
			<button
				type="button"
				className="flex w-full items-center justify-between px-3 py-2.5 bg-linear-to-r from-amber-500 to-orange-500 text-white transition-colors hover:from-amber-600 hover:to-orange-600"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<span className="text-xs font-semibold flex items-center gap-1.5">
					<span className="inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
					{t("title")}
				</span>
				<div className="flex items-center gap-1.5">
					<span className="text-[10px] font-semibold text-white/80">
						{guideStatus.completedCount}/{guideStatus.totalSteps}
					</span>
					<ChevronDownIcon
						className={cn(
							"h-3.5 w-3.5 text-white/60 transition-transform duration-200",
							!isExpanded && "-rotate-90",
						)}
					/>
				</div>
			</button>

			{isExpanded && (
				<>
					<div className="mx-3 mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
						<div
							className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-500 transition-all duration-500 ease-out"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>

					<ul className="px-2 py-1.5 space-y-0.5">
						{steps.map((step, i) => {
							const Icon = STEP_ICONS[i];
							const isClickable =
								!step.completed &&
								step.key === "checkNotifications";

							const content = (
								<li
									className={cn(
										"flex flex-col rounded-md px-2 py-1.5 text-xs transition-colors",
										step.completed
											? "text-muted-foreground"
											: "text-foreground hover:bg-accent",
										isClickable && "cursor-pointer",
									)}
									onClick={
										isClickable
											? handleNotificationCheck
											: undefined
									}
									onKeyDown={
										isClickable
											? (e) => {
													if (
														e.key === "Enter" ||
														e.key === " "
													) {
														handleNotificationCheck();
													}
												}
											: undefined
									}
									role={isClickable ? "button" : undefined}
									tabIndex={isClickable ? 0 : undefined}
								>
									<div className="flex items-center gap-2">
										{step.completed ? (
											<CheckCircle2Icon className="h-3.5 w-3.5 shrink-0 text-green-500" />
										) : (
											<Icon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
										)}
										<span
											className={cn(
												"font-medium",
												step.completed && "line-through",
											)}
										>
											{t(`steps.${step.key}`)}
										</span>
									</div>
									{!step.completed && (
										<span className="ml-5.5 mt-0.5 text-[10px] leading-tight text-muted-foreground">
											{t(`steps.${step.key}Hint`)}
										</span>
									)}
								</li>
							);

							if (!step.completed && step.href) {
								return (
									<Link
										key={step.key}
										href={step.href}
										prefetch
									>
										{content}
									</Link>
								);
							}

							return (
								<div key={step.key}>{content}</div>
							);
						})}
					</ul>
				</>
			)}
		</div>
	);
}
