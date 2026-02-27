import {
	getOrganizationById,
	getUserById,
	updateOrganization,
	updateUser,
} from "@repo/database";

export async function setCustomerIdToEntity(
	customerId: string,
	{ organizationId, userId }: { organizationId?: string; userId?: string },
) {
	if (organizationId) {
		await updateOrganization({
			id: organizationId,
			paymentsCustomerId: customerId,
		});
	} else if (userId) {
		await updateUser({
			id: userId,
			paymentsCustomerId: customerId,
		});
	}
}

export const getCustomerIdFromEntity = async (
	props: { organizationId: string } | { userId: string },
) => {
	if ("organizationId" in props) {
		return (
			(await getOrganizationById(props.organizationId))
				?.paymentsCustomerId ?? null
		);
	}

	return (await getUserById(props.userId))?.paymentsCustomerId ?? null;
};
