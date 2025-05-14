import { db } from "@repo/database";

export const getOrganizationById = async (id: string) => {
	const organization = await db.organization.findUnique({
		where: {
			id,
		},
	});

	return organization;
};
