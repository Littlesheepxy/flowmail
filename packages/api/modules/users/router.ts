import { createAvatarUploadUrl } from "./procedures/create-avatar-upload-url";
import { exportUserData } from "./procedures/export-data";

export const usersRouter = {
	avatarUploadUrl: createAvatarUploadUrl,
	exportData: exportUserData,
};
