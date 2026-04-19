import path from "node:path";
import { fileURLToPath } from "node:url";
import { withContentCollections } from "@content-collections/next";
// @ts-expect-error - PrismaPlugin is not typed
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import type { NextConfig } from "next";
import nextIntlPlugin from "next-intl/plugin";

const withNextIntl = nextIntlPlugin("./modules/i18n/request.ts");

const monorepoRoot = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);

const securityHeaders = [
	{
		key: "Strict-Transport-Security",
		value: "max-age=63072000; includeSubDomains; preload",
	},
	{
		key: "X-Content-Type-Options",
		value: "nosniff",
	},
	{
		key: "X-Frame-Options",
		value: "DENY",
	},
	{
		key: "X-XSS-Protection",
		value: "1; mode=block",
	},
	{
		key: "Referrer-Policy",
		value: "strict-origin-when-cross-origin",
	},
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
	},
	{
		key: "X-DNS-Prefetch-Control",
		value: "on",
	},
	{
		key: "Content-Security-Policy",
		value: [
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"img-src 'self' data: blob: https: http:",
			"font-src 'self' https://fonts.gstatic.com data:",
			"connect-src 'self' https://*.stripe.com https://*.vercel.app wss: https:",
			"frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com",
			"object-src 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"frame-ancestors 'none'",
			"upgrade-insecure-requests",
		].join("; "),
	},
];

const nextConfig: NextConfig = {
	output: "standalone",
	outputFileTracingRoot: monorepoRoot,
	// pdfjs-dist 5.x 在 Node 环境会 dynamic import pdf.worker.mjs 作为 fake worker；
	// nft 静态分析追不到这个动态路径，需要显式包进 standalone 输出，否则 OCR 时报
	// "Setting up fake worker failed: Cannot find module 'pdf.worker.mjs'"。
	outputFileTracingIncludes: {
		"/api/**/*": [
			"../../node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/**",
			"../../node_modules/.pnpm/pdf-to-png-converter@*/node_modules/pdf-to-png-converter/**",
			"../../node_modules/pdfjs-dist/legacy/build/**",
		],
	},
	typescript: {
		ignoreBuildErrors: true,
	},
	serverExternalPackages: [
		"livekit-server-sdk",
		"@napi-rs/canvas",
		"pdf-to-png-converter",
		"pdf-parse",
		"pdfjs-dist",
	],
	transpilePackages: [
		"@repo/api",
		"@repo/auth",
		"@repo/database",
		"@repo/mail",
		"@repo/ui",
	],
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: securityHeaders,
			},
		];
	},
	images: {
		remotePatterns: [
			{
				// google profile images
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
			{
				// github profile images
				protocol: "https",
				hostname: "avatars.githubusercontent.com",
			},
			{
				// placeholder images
				protocol: "https",
				hostname: "picsum.photos",
			},
		],
	},
	async redirects() {
		return [
			{
				source: "/app/settings",
				destination: "/app/settings/general",
				permanent: true,
			},
			{
				source: "/app/:organizationSlug/settings",
				destination: "/app/:organizationSlug/settings/general",
				permanent: true,
			},
			{
				source: "/app/admin",
				destination: "/app/admin/users",
				permanent: true,
			},
		];
	},
	webpack: (config, { webpack, isServer }) => {
		config.plugins.push(
			new webpack.IgnorePlugin({
				resourceRegExp: /^pg-native$|^cloudflare:sockets$/,
			}),
		);

		if (isServer) {
			config.plugins.push(new PrismaPlugin());
		}

		return config;
	},
};

export default withContentCollections(withNextIntl(nextConfig));
