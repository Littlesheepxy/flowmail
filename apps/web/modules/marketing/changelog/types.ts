import type { ReactNode } from "react";

export type ChangelogItem = {
	date: string;
	title: string;
	changes: ReactNode[];
};
