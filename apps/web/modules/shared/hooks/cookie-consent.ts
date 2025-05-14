"use client";

import { ConsentContext } from "@shared/components/ConsentProvider";
import { useContext } from "react";

export function useCookieConsent() {
	return useContext(ConsentContext);
}
