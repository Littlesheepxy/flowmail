import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const monorepoRoot = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);

const config: NextConfig = {
	output: "standalone",
	outputFileTracingRoot: monorepoRoot,
	reactStrictMode: true,
	typescript: {
		ignoreBuildErrors: true,
	},
	async rewrites() {
		return [
			{
				source: "/:path*.mdx",
				destination: "/llms.mdx/:path*",
			},
		];
	},
};

export default withMDX(config);
