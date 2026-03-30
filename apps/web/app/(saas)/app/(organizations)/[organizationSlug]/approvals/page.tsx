import { redirect } from "next/navigation";

export default async function ApprovalsPage({
	params,
}: {
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;
	redirect(`/app/${organizationSlug}/inbox?category=approval`);
}
