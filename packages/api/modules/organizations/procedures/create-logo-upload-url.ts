import { config } from "@repo/config";
import { getSignedUploadUrl } from "@repo/storage";
import { protectedProcedure } from "../../../orpc/procedures";

export const createLogoUploadUrl = protectedProcedure
	.route({
		method: "POST",
		path: "/organizations/logo-upload-url",
		tags: ["Organizations"],
		summary: "Create logo upload URL",
		description:
			"Create a signed upload URL to upload an avatar image to the storage bucket",
	})
	.handler(async ({ context: { user } }) => {
		const signedUploadUrl = await getSignedUploadUrl(`${user.id}.png`, {
			bucket: config.storage.bucketNames.avatars,
		});

		return { signedUploadUrl };
	});
