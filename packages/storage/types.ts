import type { config } from "./config";

export type CreateBucketHandler = (
	name: string,
	options?: {
		public?: boolean;
	},
) => Promise<void>;

export type GetSignedUploadUrlHandler = (
	path: string,
	options: {
		bucket: keyof typeof config.bucketNames;
	},
) => Promise<string>;

export type GetSignedUrlHander = (
	path: string,
	options: {
		bucket: keyof typeof config.bucketNames;
		expiresIn?: number;
	},
) => Promise<string>;

export type UploadObjectHandler = (
	path: string,
	body: Buffer | Uint8Array,
	options: {
		bucket: keyof typeof config.bucketNames;
		contentType?: string;
	},
) => Promise<void>;
