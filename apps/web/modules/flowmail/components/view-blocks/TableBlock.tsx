"use client";

import { Card } from "@repo/ui/components/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import type { TableBlock as Spec } from "@repo/api";

export function TableBlock({ block }: { block: Spec }) {
	if (block.rows.length === 0) {
		return (
			<Card className="p-4">
				{block.title && <h4 className="mb-2 text-sm font-semibold">{block.title}</h4>}
				<p className="py-4 text-center text-xs text-muted-foreground">暂无数据</p>
			</Card>
		);
	}
	return (
		<Card className="p-4">
			{block.title && <h4 className="mb-3 text-sm font-semibold">{block.title}</h4>}
			<Table>
				<TableHeader>
					<TableRow>
						{block.columns.map((c) => (
							<TableHead key={c.key} className="text-xs">{c.label}</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{block.rows.map((row, i) => (
						<TableRow key={i}>
							{block.columns.map((c) => (
								<TableCell key={c.key} className="text-sm">
									{row[c.key] === null || row[c.key] === undefined
										? "—"
										: String(row[c.key])}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Card>
	);
}
