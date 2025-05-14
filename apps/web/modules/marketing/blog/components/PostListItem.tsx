"use client";

import { LocaleLink } from "@i18n/routing";
import type { Post } from "@marketing/blog/types";
import Image from "next/image";

export function PostListItem({ post }: { post: Post }) {
	const { title, excerpt, authorName, image, date, path, authorImage, tags } =
		post;

	return (
		<div className="rounded-2xl border bg-card/50 p-6">
			{image && (
				<div className="-mx-4 -mt-4 relative mb-4 aspect-16/9 overflow-hidden rounded-xl">
					<Image
						src={image}
						alt={title}
						fill
						sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
						className="object-cover object-center"
					/>
					<LocaleLink
						href={`/blog/${path}`}
						className="absolute inset-0"
					/>
				</div>
			)}

			{tags && (
				<div className="mb-2 flex flex-wrap gap-2">
					{tags.map((tag) => (
						<span
							key={tag}
							className="font-semibold text-primary text-xs uppercase tracking-wider"
						>
							#{tag}
						</span>
					))}
				</div>
			)}

			<LocaleLink
				href={`/blog/${path}`}
				className="font-semibold text-xl"
			>
				{title}
			</LocaleLink>
			{excerpt && <p className="opacity-50">{excerpt}</p>}

			<div className="mt-4 flex items-center justify-between">
				{authorName && (
					<div className="flex items-center">
						{authorImage && (
							<div className="relative mr-2 size-8 overflow-hidden rounded-full">
								<Image
									src={authorImage}
									alt={authorName}
									fill
									sizes="96px"
									className="object-cover object-center"
								/>
							</div>
						)}
						<div>
							<p className="font-semibold text-sm opacity-50">
								{authorName}
							</p>
						</div>
					</div>
				)}

				<div className="mr-0 ml-auto">
					<p className="text-sm opacity-30">
						{Intl.DateTimeFormat("en-US").format(new Date(date))}
					</p>
				</div>
			</div>
		</div>
	);
}
