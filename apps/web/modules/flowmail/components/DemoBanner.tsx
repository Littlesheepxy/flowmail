"use client";

import { Spinner } from "@repo/ui";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SparklesIcon, XIcon } from "lucide-react";
import { useState } from "react";

export function DemoBanner() {
	const { activeOrganization } = useActiveOrganization();
	const queryClient = useQueryClient();
	const [dismissed, setDismissed] = useState(false);

	const clearMutation = useMutation(
		orpc.flowEntities.clearDemo.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.list.queryOptions({
						input: {
							organizationId: activeOrganization?.id ?? "",
							limit: 100,
							offset: 0,
						},
					}).queryKey,
				});
			},
		}),
	);

	if (dismissed) {
		return null;
	}

	return (
		<div data-demo-banner className="flex items-center gap-2 rounded-md bg-amber-500/8 border border-amber-500/15 px-2.5 py-1.5">
			<SparklesIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
			<span className="flex-1 text-[11px] text-muted-foreground truncate">
				Demo 数据
			</span>
			<button
				type="button"
				className="shrink-0 text-[11px] font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
				onClick={() => {
					if (activeOrganization) {
						clearMutation.mutate({
							organizationId: activeOrganization.id,
						});
					}
				}}
				disabled={clearMutation.isPending}
			>
				{clearMutation.isPending ? (
					<Spinner className="size-3" />
				) : (
					"清除"
				)}
			</button>
			<button
				type="button"
				className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
				onClick={() => setDismissed(true)}
			>
				<XIcon className="h-3 w-3" />
			</button>
		</div>
	);
}
