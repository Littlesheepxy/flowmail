"use server";

import { revalidatePath } from "next/cache";

export const clearCache = async (path?: string) => {
	try {
		if (path) {
			revalidatePath(path);
		} else {
			revalidatePath("/", "layout");
		}
	} catch (error) {
		console.error("Could not revalidate path", path, error);
	}
};
