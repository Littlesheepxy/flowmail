import { redirect } from "next/navigation";

export default async function EmailConnectionsRedirect({
	params,
}: {
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;
	redirect(`/app/${organizationSlug}/connections`);
}
