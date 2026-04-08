import {
	SearchIcon,
	SparklesIcon,
	SlidersHorizontalIcon,
	ClockIcon,
	CheckCircle2Icon,
	AlertCircleIcon,
	XCircleIcon,
	InboxIcon,
	MailIcon,
	SendIcon,
	UserIcon,
	FlagIcon,
	ArrowUpIcon,
	LayoutDashboardIcon,
	SettingsIcon,
	FileTextIcon,
	MessageSquareIcon,
	TagIcon,
	BellIcon,
	StickyNoteIcon,
	ShieldAlertIcon,
} from "lucide-react";

const entities = [
	{
		id: "1",
		category: "汇报",
		catColor: "#3b82f6",
		status: "in_progress",
		statusVariant: "info" as const,
		title: "Weekly Progress — Series B Due Diligence",
		summary: "Legal review 80% complete. Financial model validated. Key risk identified in IP assignment clause.",
		time: "04/07",
		selected: true,
	},
	{
		id: "2",
		category: "审批",
		catColor: "#f59e0b",
		status: "pending",
		statusVariant: "warning" as const,
		title: "Q3 Marketing Budget — $45,000",
		summary: "Sarah Chen requests budget for digital ads, events, and content production.",
		time: "04/07",
		selected: false,
	},
	{
		id: "3",
		category: "审批",
		catColor: "#f59e0b",
		status: "approved",
		statusVariant: "success" as const,
		title: "Vendor Contract — CloudServe Inc.",
		summary: "Annual SaaS license renewal. Legal review completed.",
		time: "04/05",
		selected: false,
	},
	{
		id: "4",
		category: "汇报",
		catColor: "#3b82f6",
		status: "received",
		statusVariant: "info" as const,
		title: "Project Alpha — Sprint 14 Report",
		summary: "5/8 stories completed. Blocker: API rate limiting.",
		time: "04/06",
		selected: false,
	},
	{
		id: "5",
		category: "问题",
		catColor: "#ef4444",
		status: "open",
		statusVariant: "warning" as const,
		title: "Delivery Delay — PCB Shortage",
		summary: "2-week delay on components. Impact on Q3 production.",
		time: "04/05",
		selected: false,
	},
	{
		id: "6",
		category: "反馈",
		catColor: "#8b5cf6",
		status: "received",
		statusVariant: "info" as const,
		title: "Product Demo Follow-up — ClientOrg",
		summary: "Positive feedback, requesting enterprise pricing details.",
		time: "04/04",
		selected: false,
	},
];

const STATUS_COLORS: Record<string, string> = {
	warning: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
	success: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
	info: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
	error: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

export default function PHInbox() {
	const grouped = new Map<string, typeof entities>();
	for (const e of entities) {
		const list = grouped.get(e.category) || [];
		list.push(e);
		grouped.set(e.category, list);
	}

	return (
		<div className="flex h-screen w-full">
			{/* Sidebar */}
			<div className="w-[220px] shrink-0 flex flex-col border-r bg-muted/30 py-3">
				<div className="flex items-center gap-2 px-4 mb-6">
					<img src="/logo-dark.png" alt="" width={24} height={24} />
					<span className="text-sm font-semibold">Flowmail</span>
				</div>
				<nav className="flex-1 px-2 space-y-0.5">
					{[
						{ icon: LayoutDashboardIcon, label: "仪表盘", active: false },
						{ icon: InboxIcon, label: "Smart Inbox", active: true },
						{ icon: CheckCircle2Icon, label: "审批中心", active: false },
						{ icon: FileTextIcon, label: "汇报跟踪", active: false },
						{ icon: TagIcon, label: "分类管理", active: false },
						{ icon: BellIcon, label: "通知中心", active: false },
					].map((item) => (
						<div
							key={item.label}
							className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
								item.active
									? "bg-primary text-primary-foreground font-medium"
									: "text-muted-foreground hover:bg-muted"
							}`}
						>
							<item.icon className="size-4" />
							{item.label}
						</div>
					))}
				</nav>
				<div className="px-2 mt-auto">
					<div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground">
						<SettingsIcon className="size-4" />
						设置
					</div>
				</div>
			</div>

			{/* Main area */}
			<div className="flex-1 flex flex-col bg-muted/40">
				{/* Top bar */}
				<div className="flex items-center gap-3 px-4 py-2 shrink-0">
					<div className="relative flex-1 max-w-md">
						<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
						<input
							type="text"
							placeholder="搜索邮件、审批、汇报..."
							className="w-full rounded-full bg-background/80 py-1.5 pl-9 pr-4 text-sm outline-none border border-border/50"
							readOnly
						/>
					</div>
					<div className="flex items-center gap-1 ml-auto">
						<div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground">
							<SlidersHorizontalIcon className="size-3.5" />
							<span>筛选</span>
						</div>
						<div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs bg-background text-primary shadow-sm">
							<SparklesIcon className="size-3.5" />
							<span>AI Agent</span>
						</div>
					</div>
				</div>

				{/* Content card */}
				<div className="flex-1 flex overflow-hidden mx-2 mb-2">
					<div className="flex-1 flex overflow-hidden bg-background rounded-2xl border shadow-sm">
						{/* Entity list */}
						<div className="w-[300px] shrink-0 flex flex-col overflow-y-auto">
							{Array.from(grouped.entries()).map(([catName, items]) => (
								<div key={catName}>
									<div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-muted/50 backdrop-blur-sm border-b">
										<div className="size-2 rounded-full shrink-0" style={{ backgroundColor: items[0].catColor }} />
										<span className="text-[11px] font-semibold text-muted-foreground">{catName}</span>
										<span className="text-[10px] text-muted-foreground/60">{items.length}</span>
									</div>
									{items.map((entity) => (
										<div
											key={entity.id}
											className={`w-full text-left px-3 py-3 border-b flex gap-2.5 ${
												entity.selected
													? "bg-primary/5 border-l-2 border-l-primary"
													: "border-l-2 border-l-transparent"
											}`}
										>
											<div className="w-1 shrink-0 rounded-full mt-1" style={{ backgroundColor: entity.catColor, height: "calc(100% - 4px)" }} />
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-1.5 mb-0.5">
													<span className="text-[10px] font-medium uppercase" style={{ color: entity.catColor }}>{entity.category}</span>
													<span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium ${STATUS_COLORS[entity.statusVariant]}`}>
														{entity.status}
													</span>
												</div>
												<p className="text-sm font-medium truncate">{entity.title}</p>
												<p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{entity.summary}</p>
												<p className="text-[10px] text-muted-foreground/60 mt-1">{entity.time}</p>
											</div>
										</div>
									))}
								</div>
							))}
						</div>

						{/* Center: Tabs — 邮件 + 时间线 */}
						<div className="flex-1 flex flex-col min-w-0 border-l">
							{/* Entity header */}
							<div className="px-4 py-3 border-b shrink-0">
								<div className="flex items-center gap-2 mb-1">
									<span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS.info}`}>
										<ClockIcon className="size-3 mr-1" />
										in_progress
									</span>
									<span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS.info}`}>
										REPORT
									</span>
									<span className="text-xs text-muted-foreground ml-auto">98% AI 置信度</span>
								</div>
								<h2 className="text-base font-semibold">Weekly Progress — Series B Due Diligence</h2>
							</div>

							{/* Tab bar */}
							<div className="flex border-b px-4">
								<div className="px-3 py-2 text-sm text-muted-foreground border-b-2 border-transparent">邮件 (3)</div>
								<div className="px-3 py-2 text-sm font-medium border-b-2 border-primary">时间线</div>
							</div>

							{/* Timeline content */}
							<div className="flex-1 overflow-y-auto px-4 py-4">
								{/* Deadline warning */}
								<div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 mb-4">
									<ClockIcon className="size-3.5 shrink-0" />
									截止还剩 5 天
								</div>

								{/* Filter tabs */}
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center gap-1.5 text-sm font-medium">
										<ClockIcon className="size-4 text-muted-foreground" />
										时间线
									</div>
									<div className="flex gap-0.5 rounded-md border bg-muted/40 p-0.5">
										{["全部", "邮件", "操作", "状态"].map((f, i) => (
											<span key={f} className={`rounded px-2 py-0.5 text-[11px] font-medium ${i === 0 ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
												{f}
											</span>
										))}
									</div>
								</div>

								{/* Timeline events */}
								<div className="space-y-0">
									{/* Event 1: Latest email */}
									<div className="flex gap-3">
										<div className="flex flex-col items-center">
											<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-300">
												<MailIcon className="size-3.5 text-zinc-700" />
											</div>
											<div className="w-0.5 flex-1 min-h-[16px] mt-0.5 rounded-full bg-border" />
										</div>
										<div className="flex-1 min-w-0 pb-3">
											<div className="rounded-lg border border-l-[3px] border-l-amber-400 bg-muted/30 p-3 ring-1 ring-amber-200/40 dark:ring-amber-700/30">
												<div className="flex items-center gap-2 mb-1.5">
													<span className="text-[11px] text-muted-foreground tabular-nums font-medium">4月7日 14:30</span>
													<span className="flex items-center gap-1 text-[11px] text-muted-foreground">
														<UserIcon className="size-3" />
														Michael Wang
													</span>
												</div>
												<p className="text-sm font-medium leading-snug">收到邮件：Series B DD — Week 3 Progress</p>

												{/* AI analysis inline */}
												<div className="mt-2 pt-2 border-t border-border/60">
													<div className="flex items-center gap-2 flex-wrap text-[11px] leading-5">
														<span className="inline-flex items-center gap-1 text-foreground/60 font-medium">
															<SparklesIcon className="size-3 shrink-0" />
															AI
														</span>
														<span className="font-medium text-emerald-600 dark:text-emerald-400">98%</span>
														<span className="inline-flex items-center rounded-sm px-1 py-px text-[10px] font-medium leading-none bg-muted text-muted-foreground border uppercase">report</span>
														<span className="text-muted-foreground">进度 80% · 风险: 中 · 阻塞: IP assignment clause</span>
													</div>

													{/* Expanded AI detail */}
													<div className="space-y-2 pt-2">
														<div className="rounded-md border overflow-hidden">
															<table className="w-full text-xs table-fixed">
																<tbody>
																	{[
																		["进度", "80%"],
																		["本周速度", "+15%"],
																		["法律审查", "已完成"],
																		["财务模型", "已验证"],
																		["阻塞项", "IP 条款需重新谈判"],
																		["风险等级", "中"],
																	].map(([k, v], i) => (
																		<tr key={k} className={i % 2 === 0 ? "bg-white/60 dark:bg-white/5" : "bg-muted/40"}>
																			<td className="px-2.5 py-1.5 text-muted-foreground font-medium whitespace-nowrap w-[35%]">{k}</td>
																			<td className="px-2.5 py-1.5 font-semibold text-left">{v}</td>
																		</tr>
																	))}
																</tbody>
															</table>
														</div>

														{/* Risk signals */}
														<div className="space-y-1">
															<p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">风险信号</p>
															<div className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
																<AlertCircleIcon className="size-3 mt-0.5 shrink-0" />
																IP assignment clause may delay closing by 2+ weeks
															</div>
															<div className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
																<AlertCircleIcon className="size-3 mt-0.5 shrink-0" />
																Legal team availability constrained next week
															</div>
														</div>
													</div>

													{/* AI Suggestion */}
													<div className="border-l-2 border-l-amber-400 rounded-r-md px-3 py-2 mt-2 bg-amber-50/30 dark:bg-amber-950/10">
														<div className="flex items-start gap-2">
															<ShieldAlertIcon className="size-3.5 mt-0.5 shrink-0 text-amber-500" />
															<div className="flex-1 min-w-0">
																<p className="text-xs leading-relaxed text-foreground/80">建议：IP 条款风险较高，应在本周内安排与对方法律团队的 follow-up meeting</p>
																<div className="flex gap-2 mt-1.5">
																	<span className="h-6 inline-flex items-center text-[11px] px-2.5 font-medium rounded border bg-amber-600 text-white border-amber-600">安排会议</span>
																	<span className="h-6 inline-flex items-center text-[11px] px-2.5 font-medium rounded border border-foreground/20 text-foreground/70 bg-background">添加备注</span>
																	<span className="h-6 inline-flex items-center text-[11px] px-2 font-medium text-muted-foreground">忽略</span>
																</div>
															</div>
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>

									{/* Event 2: Previous email */}
									<div className="flex gap-3">
										<div className="flex flex-col items-center">
											<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-300">
												<MailIcon className="size-3.5 text-zinc-700" />
											</div>
											<div className="w-0.5 flex-1 min-h-[16px] mt-0.5 rounded-full bg-border" />
										</div>
										<div className="flex-1 min-w-0 pb-3">
											<div className="rounded-lg border bg-muted/30 p-3">
												<div className="flex items-center gap-2 mb-1.5">
													<span className="text-[11px] text-muted-foreground tabular-nums font-medium">3月31日 16:05</span>
													<span className="flex items-center gap-1 text-[11px] text-muted-foreground">
														<UserIcon className="size-3" />
														Michael Wang
													</span>
												</div>
												<p className="text-sm font-medium leading-snug">收到邮件：Series B DD — Week 2 Progress</p>
												<div className="mt-2 pt-2 border-t border-border/60">
													<div className="flex items-center gap-2 text-[11px]">
														<span className="inline-flex items-center gap-1 text-foreground/60 font-medium">
															<SparklesIcon className="size-3" />
															AI
														</span>
														<span className="font-medium text-emerald-600 dark:text-emerald-400">97%</span>
														<span className="text-muted-foreground">进度 65% · 风险: 低</span>
														<span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">+15%</span>
													</div>
												</div>
											</div>
										</div>
									</div>

									{/* Event 3: Status change */}
									<div className="flex gap-3">
										<div className="flex flex-col items-center">
											<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-500">
												<AlertCircleIcon className="size-3.5 text-white" />
											</div>
											<div className="w-0.5 flex-1 min-h-[16px] mt-0.5 rounded-full bg-border" />
										</div>
										<div className="flex-1 min-w-0 pb-3">
											<div className="rounded-lg border bg-muted/30 p-3">
												<div className="flex items-center gap-2 mb-1.5">
													<span className="text-[11px] text-muted-foreground tabular-nums font-medium">3月24日 09:00</span>
												</div>
												<p className="text-sm font-medium leading-snug">状态变更：received → in_progress</p>
											</div>
										</div>
									</div>

									{/* Event 4: First email */}
									<div className="flex gap-3">
										<div className="flex flex-col items-center">
											<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-300">
												<MailIcon className="size-3.5 text-zinc-700" />
											</div>
										</div>
										<div className="flex-1 min-w-0 pb-0">
											<div className="rounded-lg border bg-muted/30 p-3">
												<div className="flex items-center gap-2 mb-1.5">
													<span className="text-[11px] text-muted-foreground tabular-nums font-medium">3月24日 08:45</span>
													<span className="flex items-center gap-1 text-[11px] text-muted-foreground">
														<UserIcon className="size-3" />
														Michael Wang
													</span>
												</div>
												<p className="text-sm font-medium leading-snug">收到邮件：Series B DD — Kickoff Report</p>
												<div className="mt-2 pt-2 border-t border-border/60">
													<div className="flex items-center gap-2 text-[11px]">
														<span className="inline-flex items-center gap-1 text-foreground/60 font-medium">
															<SparklesIcon className="size-3" />
															AI
														</span>
														<span className="font-medium text-emerald-600 dark:text-emerald-400">96%</span>
														<span className="inline-flex items-center rounded-sm px-1 py-px text-[10px] font-medium leading-none bg-muted text-muted-foreground border uppercase">report</span>
														<span className="text-muted-foreground">进度 40% · 风险: 低</span>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>

								{/* Add note */}
								<div className="border-t pt-3 mt-4">
									<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
										<StickyNoteIcon className="size-3.5" />
										添加备注
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Agent panel */}
					<div className="w-[360px] shrink-0 flex flex-col ml-0.5">
						<div className="h-full flex flex-col bg-background rounded-2xl border shadow-sm overflow-hidden">
							<div className="px-4 py-3 flex items-center justify-between border-b">
								<div className="flex items-center gap-2">
									<div className="flex items-center justify-center size-6 rounded-lg bg-foreground shadow-sm">
										<SparklesIcon className="size-3.5 text-background" />
									</div>
									<span className="text-sm font-semibold">Flowmail Agent</span>
								</div>
							</div>

							<div className="mx-3 mt-2 flex rounded-lg bg-muted/50 p-0.5">
								<div className="flex-1 rounded-md px-3 py-1 text-xs font-medium text-center bg-background text-foreground shadow-sm">当前事项</div>
								<div className="flex-1 rounded-md px-3 py-1 text-xs font-medium text-center text-muted-foreground">全部</div>
							</div>

							<div className="mx-3 mt-3 rounded-lg border bg-muted/30 px-3 py-2.5">
								<div className="flex items-center gap-1.5 mb-0.5">
									<div className="size-1.5 rounded-full bg-[var(--agent-accent)]" />
									<span className={`inline-flex items-center rounded-sm border px-1.5 py-0 text-[10px] font-medium ${STATUS_COLORS.info}`}>REPORT</span>
									<span className={`inline-flex items-center rounded-sm border px-1.5 py-0 text-[10px] font-medium ${STATUS_COLORS.info}`}>in_progress</span>
									<span className="ml-auto text-[10px] text-muted-foreground">AI 98%</span>
								</div>
								<p className="text-xs font-medium truncate">Weekly Progress — Series B DD</p>
							</div>

							{/* Chat */}
							<div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
								<div className="flex justify-end">
									<div className="max-w-[88%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2.5">
										<p className="text-sm">总结项目进展</p>
									</div>
								</div>
								<div className="flex justify-start">
									<div className="max-w-[92%] space-y-2">
										<div className="rounded-2xl rounded-bl-sm bg-muted/60 border px-3.5 py-2.5 text-sm">
											<p className="mb-2 font-semibold">Series B DD 进展总结</p>
											<p className="mb-2 leading-relaxed">经过 3 周的尽职调查，整体进度达到 <strong>80%</strong>：</p>
											<ul className="ml-4 list-disc space-y-1">
												<li>✅ 法律审查已完成</li>
												<li>✅ 财务模型已验证</li>
												<li>⚠️ <strong>IP 条款</strong>需重新谈判（主要风险）</li>
												<li>📈 本周进度 +15%</li>
											</ul>
											<p className="mt-2 leading-relaxed text-amber-600 dark:text-amber-400 font-medium">⚠️ IP assignment clause 可能导致 closing 延迟 2+ 周，建议优先处理。</p>
										</div>

										{/* Timeline diff card */}
										<div className="rounded-xl border bg-muted/30 p-3 space-y-2">
											<div className="flex items-center justify-between">
												<span className="text-[11px] font-semibold text-muted-foreground">时间线变化</span>
												<span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">+15%</span>
											</div>
											<div className="space-y-1 text-xs">
												<div className="flex items-center gap-1.5"><CheckCircle2Icon className="size-3 text-emerald-500" /><span>Legal review: 进行中 → 已完成</span></div>
												<div className="flex items-center gap-1.5"><CheckCircle2Icon className="size-3 text-emerald-500" /><span>Financial model: 草稿 → 已验证</span></div>
												<div className="flex items-center gap-1.5"><AlertCircleIcon className="size-3 text-amber-500" /><span className="text-amber-600 dark:text-amber-400">新增风险: IP assignment clause</span></div>
											</div>
										</div>
									</div>
								</div>
							</div>

							<div className="px-3 pb-2 flex gap-1.5 flex-wrap">
								{["分析风险", "查看最近变化", "有什么需要跟进的？"].map((s) => (
									<span key={s} className="text-[11px] px-3 py-1.5 rounded-full border bg-muted/30 text-muted-foreground">{s}</span>
								))}
							</div>

							<div className="px-3 pb-3 pt-1">
								<div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
									<span className="flex-1 text-sm text-muted-foreground/50">问关于「Weekly Progress...」的问题</span>
									<div className="flex items-center justify-center size-7 rounded-full bg-foreground text-background opacity-20">
										<ArrowUpIcon className="size-4" />
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
