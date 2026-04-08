import {
	BrainIcon,
	FileTextIcon,
	PackageIcon,
	CheckCircle2Icon,
	XCircleIcon,
	ClockIcon,
	PlusIcon,
	ListIcon,
	BellIcon,
} from "lucide-react";

const mcpTools = [
	{ name: "classify_email", desc: "Classify email by business intent", category: "Understanding", icon: BrainIcon, iconColor: "text-blue-600" },
	{ name: "extract_fields", desc: "Extract structured data from email", category: "Understanding", icon: FileTextIcon, iconColor: "text-blue-600" },
	{ name: "create_entity", desc: "Create trackable business item", category: "Entity", icon: PackageIcon, iconColor: "text-amber-600" },
	{ name: "approve_entity", desc: "Approve a pending request", category: "Action", icon: CheckCircle2Icon, iconColor: "text-red-600" },
	{ name: "reject_entity", desc: "Reject with reason", category: "Action", icon: XCircleIcon, iconColor: "text-red-600" },
	{ name: "get_timeline", desc: "Get entity event history", category: "Query", icon: ClockIcon, iconColor: "text-emerald-600" },
	{ name: "add_timeline_event", desc: "Add event to timeline", category: "Entity", icon: PlusIcon, iconColor: "text-amber-600" },
	{ name: "list_entities", desc: "List entities with filters", category: "Query", icon: ListIcon, iconColor: "text-emerald-600" },
	{ name: "send_notification", desc: "Trigger team notification", category: "Action", icon: BellIcon, iconColor: "text-red-600" },
];

const agents = [
	{ name: "Claude", desc: "via MCP URL", color: "text-orange-600 border-orange-200 bg-orange-50" },
	{ name: "Cursor", desc: "via .mcp.json", color: "text-blue-600 border-blue-200 bg-blue-50" },
	{ name: "GPT", desc: "via MCP URL", color: "text-emerald-600 border-emerald-200 bg-emerald-50" },
	{ name: "Custom", desc: "via stdio / SSE", color: "text-purple-600 border-purple-200 bg-purple-50" },
];

const CATEGORY_COLORS: Record<string, string> = {
	Understanding: "bg-blue-50 text-blue-600 border-blue-200",
	Entity: "bg-amber-50 text-amber-600 border-amber-200",
	Action: "bg-red-50 text-red-600 border-red-200",
	Query: "bg-emerald-50 text-emerald-600 border-emerald-200",
};

export default function PHAgent() {
	return (
		<div className="flex h-screen w-full bg-background p-8">
			{/* Left side */}
			<div className="flex flex-1 flex-col justify-center pr-8">
				<div className="mb-3 flex items-center gap-2">
					<img src="/logo-dark.png" alt="" width={24} height={24} />
					<span className="text-sm font-medium text-muted-foreground">
						Agent-Native Architecture
					</span>
				</div>

				<h1 className="mb-3 text-3xl font-medium leading-tight text-foreground">
					Built for AI agents,
					<br />
					from day one.
				</h1>

				<p className="mb-8 max-w-md text-sm leading-relaxed text-foreground/60">
					Every Flowmail capability is exposed as an MCP Tool. AI agents can
					classify emails, approve requests, track reports, and trigger
					notifications — through a standard protocol.
				</p>

				{/* Agent cards */}
				<div className="mb-8 grid grid-cols-2 gap-3">
					{agents.map((agent) => (
						<div
							key={agent.name}
							className={`rounded-lg border px-4 py-3 ${agent.color}`}
						>
							<p className="text-sm font-semibold">{agent.name}</p>
							<p className="text-xs opacity-60">{agent.desc}</p>
						</div>
					))}
				</div>

				{/* Demo interaction */}
				<div className="rounded-xl border bg-muted/30 p-4 space-y-3">
					<p className="text-xs font-medium text-muted-foreground mb-2">Agent interaction example</p>
					<div className="flex items-start gap-2.5">
						<div className="size-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
							<svg className="size-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
						</div>
						<div className="rounded-lg border bg-background px-3 py-2 font-mono text-xs text-foreground/80">
							classify_email(msg_id: &quot;e_3f8a&quot;)
						</div>
					</div>
					<div className="flex items-start gap-2.5 pl-8">
						<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-700">
							→ {"{"} type: &quot;approval&quot;, confidence: 0.99 {"}"}
						</div>
					</div>
					<div className="flex items-start gap-2.5">
						<div className="size-6 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
							<svg className="size-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
						</div>
						<div className="rounded-lg border bg-background px-3 py-2 font-mono text-xs text-foreground/80">
							approve_entity(id: &quot;ent_1024&quot;)
						</div>
					</div>
					<div className="flex items-start gap-2.5 pl-8">
						<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-700">
							→ ✓ approved, 3 actions triggered
						</div>
					</div>
				</div>
			</div>

			{/* Right side: MCP Tools */}
			<div className="flex w-96 shrink-0 flex-col rounded-xl border bg-background p-5 shadow-sm">
				<div className="mb-4 flex items-center justify-between">
					<h3 className="text-sm font-semibold text-foreground">MCP Tools</h3>
					<span className="rounded-full border border-[var(--agent-accent)]/30 bg-[var(--agent-accent)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--agent-accent)]">
						15 tools
					</span>
				</div>

				<div className="flex flex-1 flex-col gap-2 overflow-hidden">
					{mcpTools.map((tool) => (
						<div
							key={tool.name}
							className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50"
						>
							<div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
								<tool.icon className={`size-3.5 ${tool.iconColor}`} />
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate font-mono text-xs text-foreground">
									{tool.name}
								</p>
								<p className="truncate text-[10px] text-muted-foreground">
									{tool.desc}
								</p>
							</div>
							<span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-medium ${CATEGORY_COLORS[tool.category]}`}>
								{tool.category}
							</span>
						</div>
					))}
				</div>

				<div className="mt-4 rounded-lg border bg-muted/30 p-3 text-center">
					<p className="text-xs text-muted-foreground">
						Standard MCP protocol — works with any compatible agent
					</p>
				</div>
			</div>
		</div>
	);
}
