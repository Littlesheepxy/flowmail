import {
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
} from "@repo/database";

export const getPurchases = async (
	props: { organizationId: string } | { userId: string },
) => {
	if ("organizationId" in props) {
		const { organizationId } = props;
		const purchases = await getPurchasesByOrganizationId(organizationId);

		return purchases;
	}

	const { userId } = props;

	const purchases = await getPurchasesByUserId(userId);

	return purchases;
};
