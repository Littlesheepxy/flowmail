import { useContext } from "react";
import { ActiveOrganizationContext } from "../lib/active-organization-context";

export const useActiveOrganization = () => {
	const activeOrganizationContext = useContext(ActiveOrganizationContext);

	type ActiveOrganizationContextType = NonNullable<
		typeof activeOrganizationContext
	>;

	if (activeOrganizationContext === undefined) {
		return {
			activeOrganization: null,
			setActiveOrganization: () => Promise.resolve(),
			refetchActiveOrganization: () => Promise.resolve(),
			activeOrganizationUserRole: null,
			isOrganizationAdmin: false,
			loaded: true,
		} satisfies ActiveOrganizationContextType;
	}

	return activeOrganizationContext;
};
