import type { PropsWithChildren } from "react";

export function SettingsList({ children }: PropsWithChildren) {
	return (
		<div className="@container flex flex-col gap-4">
			{Array.isArray(children)
				? children.filter(Boolean).map((child, i) => {
						return <div key={`settings-item-${i}`}>{child}</div>;
					})
				: children}
		</div>
	);
}
