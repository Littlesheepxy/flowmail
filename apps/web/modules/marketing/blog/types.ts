import type { Post as ContentCollectionsPost } from "content-collections";

export type Post = Omit<ContentCollectionsPost, "_meta">;
