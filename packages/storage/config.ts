export const config = {
	bucketNames: {
		avatars: process.env.NEXT_PUBLIC_AVATARS_BUCKET_NAME ?? "avatars",
		attachments: process.env.ATTACHMENTS_BUCKET_NAME ?? "attachments",
	},
} as const;
