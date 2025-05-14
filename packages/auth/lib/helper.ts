import type { ActiveOrganization } from "../auth";

export function isOrganizationAdmin(
	organization?: ActiveOrganization | null,
	user?: {
		id: string;
		role?: string | null;
	} | null,
) {
	const userOrganizationRole = organization?.members.find(
		(member) => member.userId === user?.id,
	)?.role;

	return (
		["owner", "admin"].includes(userOrganizationRole ?? "") ||
		user?.role === "admin"
	);
}
