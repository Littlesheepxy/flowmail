"use client";

import { MDXContent } from "@content-collections/mdx/react";
import { mdxComponents } from "../utils/mdx-components";

export function PostContent({ content }: { content: string }) {
	return (
		<div className="mx-auto mt-8 max-w-2xl">
			<MDXContent code={content} components={mdxComponents} />
		</div>
	);
}
