import type { ReactNode } from "react";

export type ChangelogItem = {
	date: string;
	changes: ReactNode[];
};
