"use client";

import { MDXContent } from "@content-collections/mdx/react";
import { mdxComponents } from "../utils/mdx-components";

export function PostContent({ content }: { content: string }) {
	return (
		<div className="prose dark:prose-invert mx-auto mt-6 max-w-2xl">
			<MDXContent
				code={content}
				components={{
					a: mdxComponents.a,
				}}
			/>
		</div>
	);
}
