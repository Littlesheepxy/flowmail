import { LocaleLink } from "@i18n/routing";
import { slugifyHeadline } from "@shared/lib/content";
import type { MDXComponents } from "mdx/types";
import type { ImageProps } from "next/image";
import Image from "next/image";

export const mdxComponents = {
	a: (props) => {
		const { href, children, ...rest } = props;
		const isInternalLink =
			href && (href.startsWith("/") || href.startsWith("#"));

		return isInternalLink ? (
			<LocaleLink href={href} {...rest}>
				{children}
			</LocaleLink>
		) : (
			<a target="_blank" rel="noopener noreferrer" href={href} {...rest}>
				{children}
			</a>
		);
	},
	img: (props) =>
		props.src ? (
			<Image
				{...(props as ImageProps)}
				sizes="100vw"
				style={{ width: "100%", height: "auto" }}
				className="rounded-lg shadow"
				loading="lazy"
			/>
		) : null,
	h1: ({ children, ...rest }) => (
		<h1
			id={slugifyHeadline(children as string)}
			className="mb-6 font-bold text-4xl"
			{...rest}
		>
			{children}
		</h1>
	),
	h2: ({ children, ...rest }) => (
		<h2
			id={slugifyHeadline(children as string)}
			className="mb-4 font-bold text-2xl"
			{...rest}
		>
			{children}
		</h2>
	),
	h3: ({ children, ...rest }) => (
		<h3
			id={slugifyHeadline(children as string)}
			className="mb-4 font-bold text-xl"
			{...rest}
		>
			{children}
		</h3>
	),
	h4: ({ children, ...rest }) => (
		<h4
			id={slugifyHeadline(children as string)}
			className="mb-4 font-bold text-lg"
			{...rest}
		>
			{children}
		</h4>
	),
	h5: ({ children, ...rest }) => (
		<h5
			id={slugifyHeadline(children as string)}
			className="mb-4 font-bold text-base"
			{...rest}
		>
			{children}
		</h5>
	),
	h6: ({ children, ...rest }) => (
		<h6
			id={slugifyHeadline(children as string)}
			className="mb-4 font-bold text-sm"
			{...rest}
		>
			{children}
		</h6>
	),
	p: ({ children, ...rest }) => (
		<p className="mb-6 text-foreground/60 leading-relaxed" {...rest}>
			{children}
		</p>
	),
	ul: ({ children, ...rest }) => (
		<ul className="mb-6 list-inside list-disc space-y-2 pl-4" {...rest}>
			{children}
		</ul>
	),
	ol: ({ children, ...rest }) => (
		<ol className="mb-6 list-inside list-decimal space-y-2 pl-4" {...rest}>
			{children}
		</ol>
	),
	li: ({ children, ...rest }) => <li {...rest}>{children}</li>,
} satisfies MDXComponents;
