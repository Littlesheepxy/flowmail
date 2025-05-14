import type { Post } from "@marketing/blog/types";
import { allPosts } from "content-collections";

export async function getAllPosts(): Promise<Post[]> {
	// ... add a custom loader here for your posts and map it to the post schema

	return Promise.resolve(allPosts);
}

export async function getPostBySlug(
	slug: string,
	options?: {
		locale?: string;
	},
): Promise<Post | null> {
	// ... add a custom loader here for your posts and map it to the post schema

	return Promise.resolve(
		allPosts.find(
			(post) =>
				post.path === slug &&
				(!options?.locale || post.locale === options.locale),
		) ?? null,
	);
}
