"use client";

import Cookies from "js-cookie";
import { createContext, useState } from "react";

export const ConsentContext = createContext<{
	userHasConsented: boolean;
	allowCookies: () => void;
	declineCookies: () => void;
}>({
	userHasConsented: false,
	allowCookies: () => {},
	declineCookies: () => {},
});

export function ConsentProvider({
	children,
	initialConsent,
}: {
	children: React.ReactNode;
	initialConsent?: boolean;
}) {
	const [userHasConsented, setUserHasConsented] = useState(!!initialConsent);

	const allowCookies = () => {
		Cookies.set("consent", "true", { expires: 30 });
		setUserHasConsented(true);
	};

	const declineCookies = () => {
		Cookies.set("consent", "false", { expires: 30 });
		setUserHasConsented(false);
	};

	return (
		<ConsentContext.Provider
			value={{ userHasConsented, allowCookies, declineCookies }}
		>
			{children}
		</ConsentContext.Provider>
	);
}
