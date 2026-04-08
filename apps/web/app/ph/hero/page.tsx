export default function PHHero() {
	return (
		<div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-background">
			{/* Colorful gradient orbs — matching hero NoiseBackground palette */}
			<div className="pointer-events-none absolute -left-60 top-20 h-[600px] w-[600px] rounded-full bg-[rgb(255,100,150)]/10 blur-[150px]" />
			<div className="pointer-events-none absolute -right-40 top-0 h-[500px] w-[500px] rounded-full bg-[rgb(100,150,255)]/10 blur-[150px]" />
			<div className="pointer-events-none absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-[rgb(255,200,100)]/10 blur-[120px]" />

			<div
				className="pointer-events-none absolute inset-0 opacity-[0.015]"
				style={{
					backgroundImage:
						"linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.08) 1px, transparent 1px)",
					backgroundSize: "60px 60px",
				}}
			/>

			<div className="relative z-10 flex flex-col items-center gap-8 px-8 text-center">
				{/* Badge — matching hero NoiseBackground */}
				<div className="rounded-full bg-gradient-to-r from-[rgb(255,100,150)]/10 via-[rgb(100,150,255)]/10 to-[rgb(255,200,100)]/10 p-[2px]">
					<div className="rounded-full bg-background/90 backdrop-blur-sm px-5 py-2 flex items-center gap-2 text-sm shadow-sm border border-border/50">
						<span className="font-semibold text-foreground">AI-Powered</span>
						<span className="text-foreground/30">&middot;</span>
						<span className="font-medium text-foreground/70">Agent-Native</span>
					</div>
				</div>

				{/* Logo */}
				<div className="flex items-center gap-3">
					<img src="/logo-dark.png" alt="Flowmail" width={48} height={48} />
					<span className="text-3xl font-semibold tracking-tight text-foreground">
						Flowmail
					</span>
				</div>

				{/* Headline */}
				<h1 className="max-w-3xl text-5xl font-medium leading-[1.15] tracking-tight text-foreground">
					Stop reading emails.
					<br />
					Start executing.
				</h1>

				{/* Subtitle */}
				<p className="max-w-xl text-lg leading-relaxed text-foreground/60">
					AI-powered email execution platform.
					<br />
					Classify, extract, approve, and track — all from your inbox.
				</p>

				{/* Colored pills */}
				<div className="flex items-center gap-3">
					<span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700">
						Approvals
					</span>
					<span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
						Reports
					</span>
					<span className="rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-sm font-medium text-red-700">
						Issues
					</span>
					<span className="rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-sm font-medium text-purple-700">
						Feedback
					</span>
				</div>

				<p className="mt-2 text-sm tracking-wide text-foreground/30">
					flowmail.work
				</p>
			</div>
		</div>
	);
}
