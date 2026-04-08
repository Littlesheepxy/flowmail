const steps = [
	{
		number: "01",
		title: "Connect",
		desc: "Link your Gmail, Outlook, Feishu, or any IMAP inbox in one click. No forwarding, no migration.",
		icons: ["Gmail", "Outlook", "Feishu", "IMAP"],
		color: "from-blue-600 to-blue-500",
		borderColor: "border-blue-200",
		bgColor: "bg-blue-50",
		tagBorder: "border-blue-200 text-blue-600",
	},
	{
		number: "02",
		title: "Understand",
		desc: "AI classifies every email by business intent, extracts structured fields — deadlines, amounts, owners — with 98.5% accuracy.",
		icons: ["Classify", "Extract", "Structure"],
		color: "from-amber-600 to-amber-500",
		borderColor: "border-amber-200",
		bgColor: "bg-amber-50",
		tagBorder: "border-amber-200 text-amber-600",
	},
	{
		number: "03",
		title: "Execute",
		desc: "Approve requests, track reports, trigger notifications — one click fires the entire execution chain across your tools.",
		icons: ["Approve", "Track", "Notify"],
		color: "from-red-500 to-rose-500",
		borderColor: "border-red-200",
		bgColor: "bg-red-50",
		tagBorder: "border-red-200 text-red-600",
	},
];

export default function PHHowItWorks() {
	return (
		<div className="flex h-screen w-full flex-col items-center justify-center bg-background px-12">
			{/* Header */}
			<div className="mb-12 text-center">
				<div className="mb-3 flex items-center justify-center gap-2">
					<img src="/logo-dark.png" alt="" width={24} height={24} />
					<span className="text-sm font-medium text-muted-foreground">
						How it works
					</span>
				</div>
				<h2 className="text-4xl font-medium tracking-tight text-foreground">
					Three steps from email to action
				</h2>
				<p className="mt-3 text-lg text-foreground/60">
					Connect your inbox and let AI handle the rest
				</p>
			</div>

			{/* Steps */}
			<div className="flex w-full max-w-5xl items-stretch gap-6">
				{steps.map((step, i) => (
					<div key={step.number} className="flex flex-1 items-stretch gap-6">
						<div
							className={`flex flex-1 flex-col rounded-2xl border ${step.borderColor} ${step.bgColor} p-6`}
						>
							<span
								className={`mb-4 inline-block bg-gradient-to-r ${step.color} bg-clip-text text-5xl font-bold text-transparent`}
							>
								{step.number}
							</span>

							<h3 className="mb-2 text-xl font-semibold text-foreground">
								{step.title}
							</h3>

							<p className="mb-4 flex-1 text-sm leading-relaxed text-foreground/60">
								{step.desc}
							</p>

							<div className="flex flex-wrap gap-2">
								{step.icons.map((icon) => (
									<span
										key={icon}
										className={`rounded-md border bg-background px-2.5 py-1 text-xs font-medium ${step.tagBorder}`}
									>
										{icon}
									</span>
								))}
							</div>
						</div>

						{i < 2 && (
							<div className="flex items-center text-foreground/20">
								<svg
									className="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={1.5}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
									/>
								</svg>
							</div>
						)}
					</div>
				))}
			</div>

			<p className="mt-10 text-sm text-foreground/30">
				flowmail.work
			</p>
		</div>
	);
}
