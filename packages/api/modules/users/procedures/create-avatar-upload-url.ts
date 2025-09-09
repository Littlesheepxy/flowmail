import { config } from "@repo/config";
import { getSignedUploadUrl } from "@repo/storage";
import { protectedProcedure } from "../../../orpc/procedures";

export const createAvatarUploadUrl = protectedProcedure
	.route({
		method: "POST",
		path: "/users/avatar-upload-url",
		tags: ["Users"],
		summary: "Create avatar upload URL",
		description:
			"Create a signed upload URL to upload an avatar image to the storage bucket",
	})
	.handler(async ({ context: { user } }) => {
		const signedUploadUrl = await getSignedUploadUrl(`${user.id}.png`, {
			bucket: config.storage.bucketNames.avatars,
		});

		return { signedUploadUrl };
	});
