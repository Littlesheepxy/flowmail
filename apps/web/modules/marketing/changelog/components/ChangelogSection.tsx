import { formatDate, formatDistance, parseISO } from "date-fns";
import type { ChangelogItem } from "../types";

export function ChangelogSection({ items }: { items: ChangelogItem[] }) {
	return (
		<section id="changelog">
			<div className="mx-auto grid w-full max-w-xl grid-cols-1 gap-4 text-left">
				{items?.map((item, i) => (
					<div key={i} className="rounded-3xl bg-muted p-6 lg:p-8">
						<div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
							<h2 className="text-xl font-semibold">
								{item.title}
							</h2>
							<small
								className="font-medium text-primary uppercase tracking-wide text-xs whitespace-nowrap"
								title={formatDate(
									parseISO(item.date),
									"yyyy-MM-dd",
								)}
							>
								{formatDistance(
									parseISO(item.date),
									new Date(),
									{
										addSuffix: true,
									},
								)}
							</small>
						</div>
						<ul className="mt-4 list-disc space-y-2 pl-6">
							{item.changes.map((change, j) => (
								<li key={j}>{change}</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</section>
	);
}
