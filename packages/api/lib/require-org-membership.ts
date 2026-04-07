import { ORPCError } from "@orpc/server";
import { getOrganizationMembership } from "@repo/database";

/**
 * Verifies the user belongs to the given organization.
 * Throws FORBIDDEN if not a member. Returns the membership role.
 */
export async function requireOrgMembership(
	organizationId: string,
	userId: string,
) {
	const membership = await getOrganizationMembership(organizationId, userId);

	if (!membership) {
		throw new ORPCError("FORBIDDEN", {
			message: "You are not a member of this organization",
		});
	}

	return { organization: membership.organization, role: membership.role };
}

/**
 * Verifies the user belongs to the organization that owns the given resource.
 * Use for procedures that only receive a resourceId (entityId, connectionId, etc.)
 * but need org membership validation.
 */
export async function requireOrgMembershipForResource(
	resourceOrgId: string,
	userId: string,
) {
	return requireOrgMembership(resourceOrgId, userId);
}
