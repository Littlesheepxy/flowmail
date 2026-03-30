"use client";

import Cookies from "js-cookie";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

const SIDEBAR_COLLAPSED_COOKIE = "sidebar-collapsed";

interface SidebarContextValue {
	isCollapsed: boolean;
	setIsCollapsed: (collapsed: boolean) => void;
	toggleCollapsed: () => void;
	requestAutoCollapse: () => void;
	releaseAutoCollapse: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(
	undefined,
);

export function SidebarProvider({ children }: { children: ReactNode }) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [autoCollapsed, setAutoCollapsed] = useState(false);
	const userPreferenceRef = useRef(false);

	useEffect(() => {
		const cookieValue = Cookies.get(SIDEBAR_COLLAPSED_COOKIE);
		if (cookieValue !== undefined) {
			const val = cookieValue === "true";
			setIsCollapsed(val);
			userPreferenceRef.current = val;
		}
	}, []);

	const handleSetIsCollapsed = useCallback((collapsed: boolean) => {
		setIsCollapsed(collapsed);
		userPreferenceRef.current = collapsed;
		Cookies.set(SIDEBAR_COLLAPSED_COOKIE, collapsed ? "true" : "false", {
			expires: 365,
		});
	}, []);

	const handleToggleCollapsed = useCallback(() => {
		const newValue = !isCollapsed;
		setIsCollapsed(newValue);
		userPreferenceRef.current = newValue;
		setAutoCollapsed(false);
		Cookies.set(SIDEBAR_COLLAPSED_COOKIE, newValue ? "true" : "false", {
			expires: 365,
		});
	}, [isCollapsed]);

	const requestAutoCollapse = useCallback(() => {
		setAutoCollapsed(true);
		setIsCollapsed(true);
	}, []);

	const releaseAutoCollapse = useCallback(() => {
		setAutoCollapsed(false);
		setIsCollapsed(userPreferenceRef.current);
	}, []);

	return (
		<SidebarContext.Provider
			value={{
				isCollapsed: autoCollapsed ? true : isCollapsed,
				setIsCollapsed: handleSetIsCollapsed,
				toggleCollapsed: handleToggleCollapsed,
				requestAutoCollapse,
				releaseAutoCollapse,
			}}
		>
			{children}
		</SidebarContext.Provider>
	);
}

export function useSidebar() {
	const context = useContext(SidebarContext);
	if (context === undefined) {
		throw new Error("useSidebar must be used within a SidebarProvider");
	}
	return context;
}
