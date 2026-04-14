"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { BrainIcon, ChevronDownIcon, ChevronUpIcon, UserIcon } from "lucide-react";
import { useState } from "react";

const FIELD_LABELS: Record<string, string> = {
	role: "职务",
	company: "公司",
	communication_style: "沟通风格",
	sensitivity: "敏感点",
	relationship: "关系",
	preferences: "偏好",
	habits: "习惯",
};

interface ContactMemoryCardProps {
	organizationId: string;
	contactEmail: string;
	contactName?: string;
}

export function ContactMemoryCard({
	organizationId,
	contactEmail,
	contactName,
}: ContactMemoryCardProps) {
	const [expanded, setExpanded] = useState(false);

	const { data, isLoading } = useQuery({
		...orpc.memory.listObjects.queryOptions({
			input: { organizationId, objectType: "person", objectId: contactEmail },
		}),
		enabled: !!contactEmail && !!organizationId,
		staleTime: 60_000,
	});

	if (isLoading || !data || data.items.length === 0) {
		return null;
	}

	const person = data.items[0];
	const attrs = person.attributes as Record<string, unknown>;
	const displayName = contactName || person.name || contactEmail;
	const attrEntries = Object.entries(attrs).filter(([, v]) => v != null && v !== "");

	if (attrEntries.length === 0) {
		return null;
	}

	return (
		<div className="px-3 md:px-5 py-1.5 border-b">
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full"
			>
				<BrainIcon className="size-3 text-violet-500" />
				<span className="flex-1 text-left truncate">
					AI 对 <span className="font-medium text-foreground/70">{displayName}</span> 的认知
					<span className="ml-1 text-muted-foreground/60">({attrEntries.length}项)</span>
				</span>
				{expanded ? (
					<ChevronUpIcon className="size-3 shrink-0" />
				) : (
					<ChevronDownIcon className="size-3 shrink-0" />
				)}
			</button>

			{expanded && (
				<div className="mt-1.5 space-y-1 pb-1">
					{attrEntries.map(([key, value]) => {
						const label = FIELD_LABELS[key] ?? key;
						const str = typeof value === "string" ? value
							: Array.isArray(value) ? value.join("、")
							: String(value);
						const isLong = str.length >= 50 || str.includes("\n");

						return (
							<div
								key={key}
								className="flex items-start gap-2 rounded-md bg-muted/30 px-2.5 py-1.5"
							>
								<UserIcon className="size-3 mt-0.5 shrink-0 text-violet-400" />
								<div className="flex-1 min-w-0">
									{isLong ? (
										<>
											<p className="text-[10px] text-muted-foreground/70 mb-0.5">{label}</p>
											<p className="text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
												{str}
											</p>
										</>
									) : (
										<p className="text-[11px] leading-relaxed text-foreground/80">
											<span className="text-muted-foreground/60">{label}: </span>
											{str}
										</p>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
