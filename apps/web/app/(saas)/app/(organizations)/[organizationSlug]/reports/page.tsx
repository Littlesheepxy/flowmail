import { redirect } from "next/navigation";

export default async function ReportsPage({
	params,
}: {
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;
	redirect(`/app/${organizationSlug}/inbox?category=report`);
}
