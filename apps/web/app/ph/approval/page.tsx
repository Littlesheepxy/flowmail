import {
	CheckCircle2Icon,
	FileTextIcon,
	AlertCircleIcon,
	MessageSquareIcon,
	ClockIcon,
	ListTodoIcon,
	MailIcon,
	InboxIcon,
	LayoutDashboardIcon,
	SettingsIcon,
	TagIcon,
	BellIcon,
	SparklesIcon,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
	warning: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
	success: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
	info: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
};

const recentEntities = [
	{ title: "Q3 Marketing Budget Approval — $45,000", type: "APPROVAL", status: "pending", statusVariant: "warning", summary: "Sarah Chen requests budget for Q3 marketing campaign.", time: "04/07", icon: CheckCircle2Icon, iconColor: "text-amber-600", iconBg: "bg-amber-500/10" },
	{ title: "Weekly Progress — Series B Due Diligence", type: "REPORT", status: "in_progress", statusVariant: "info", summary: "Legal review 80% complete. Key risk in IP clause.", time: "04/07", icon: FileTextIcon, iconColor: "text-blue-600", iconBg: "bg-blue-500/10" },
	{ title: "Vendor Contract — CloudServe Inc.", type: "APPROVAL", status: "approved", statusVariant: "success", summary: "Annual SaaS license renewal approved.", time: "04/06", icon: CheckCircle2Icon, iconColor: "text-amber-600", iconBg: "bg-amber-500/10" },
	{ title: "Delivery Delay — PCB Component Shortage", type: "ISSUE", status: "open", statusVariant: "warning", summary: "2-week delay on components due to supply chain issues.", time: "04/05", icon: AlertCircleIcon, iconColor: "text-red-600", iconBg: "bg-red-500/10" },
	{ title: "Project Alpha — Sprint 14 Report", type: "REPORT", status: "received", statusVariant: "info", summary: "5/8 stories completed. Blocker: API rate limiting.", time: "04/06", icon: FileTextIcon, iconColor: "text-blue-600", iconBg: "bg-blue-500/10" },
	{ title: "Product Demo Follow-up — ClientOrg", type: "FEEDBACK", status: "received", statusVariant: "info", summary: "Positive feedback, requesting enterprise pricing.", time: "04/04", icon: MessageSquareIcon, iconColor: "text-emerald-600", iconBg: "bg-emerald-500/10" },
];

export default function PHDashboard() {
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
						{ icon: LayoutDashboardIcon, label: "仪表盘", active: true },
						{ icon: InboxIcon, label: "Smart Inbox", active: false },
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

			{/* Main */}
			<div className="flex-1 overflow-y-auto bg-muted/40 px-8 py-6">
				<div className="max-w-5xl mx-auto space-y-8">
					<div>
						<h1 className="text-xl font-semibold mb-1">仪表盘</h1>
						<p className="text-sm text-muted-foreground">所有邮件事项的概览</p>
					</div>

					{/* Category distribution */}
					<div>
						<h3 className="text-sm font-medium text-muted-foreground mb-3">分类分布</h3>
						<div className="grid grid-cols-4 gap-3">
							{[
								{ type: "审批", icon: CheckCircle2Icon, color: "text-amber-600", bg: "bg-amber-500/10", count: 5 },
								{ type: "汇报", icon: FileTextIcon, color: "text-blue-600", bg: "bg-blue-500/10", count: 8 },
								{ type: "问题", icon: AlertCircleIcon, color: "text-red-600", bg: "bg-red-500/10", count: 3 },
								{ type: "反馈", icon: MessageSquareIcon, color: "text-emerald-600", bg: "bg-emerald-500/10", count: 2 },
							].map((item) => (
								<div key={item.type} className="rounded-xl border bg-background p-4 hover:border-primary/30 transition-colors">
									<div className="flex items-center justify-between mb-2">
										<div className={`size-8 rounded-lg flex items-center justify-center ${item.bg}`}>
											<item.icon className={`size-4 ${item.color}`} />
										</div>
										<span className="text-2xl font-bold tabular-nums">{item.count}</span>
									</div>
									<p className="text-sm text-muted-foreground">{item.type}</p>
								</div>
							))}
						</div>
					</div>

					{/* Quick stats */}
					<div className="grid grid-cols-4 gap-3">
						{[
							{ icon: ClockIcon, label: "待审批", value: "3" },
							{ icon: AlertCircleIcon, label: "已阻塞", value: "1" },
							{ icon: ListTodoIcon, label: "需复核", value: "2" },
							{ icon: MailIcon, label: "已连接邮箱", value: "2" },
						].map((stat) => (
							<div key={stat.label} className="rounded-xl border bg-background p-4">
								<div className="flex items-center gap-2 text-muted-foreground mb-1">
									<stat.icon className="size-3.5" />
									<span className="text-xs">{stat.label}</span>
								</div>
								<p className="text-xl font-bold">{stat.value}</p>
							</div>
						))}
					</div>

					{/* Recent activity */}
					<div>
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-sm font-medium text-muted-foreground">近期动态</h3>
							<span className="text-xs text-primary">查看全部</span>
						</div>
						<div className="space-y-1.5">
							{recentEntities.map((entity) => (
								<div key={entity.title} className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5">
									<div className={`size-7 rounded flex items-center justify-center shrink-0 ${entity.iconBg}`}>
										<entity.icon className={`size-3.5 ${entity.iconColor}`} />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium truncate">{entity.title}</p>
										<p className="text-xs text-muted-foreground truncate">{entity.summary}</p>
									</div>
									<span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium shrink-0 ${STATUS_COLORS[entity.statusVariant]}`}>
										{entity.status}
									</span>
									<span className="text-[10px] text-muted-foreground/60 shrink-0">{entity.time}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
