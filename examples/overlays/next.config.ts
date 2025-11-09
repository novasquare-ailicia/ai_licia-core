import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "ai_licia-core";
const isGithubPages = process.env.GITHUB_ACTIONS === "true";

const sanitizeBasePath = (value?: string) => {
  if (!value || value === "/") {
    return undefined;
  }

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");

  return withoutTrailingSlash || undefined;
};

const explicitBasePath = sanitizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
const inferredBasePath = isGithubPages ? `/${repoName}` : undefined;
const basePath = explicitBasePath ?? inferredBasePath;

const nextConfig = {
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: projectRoot,
  },
} as NextConfig & {
  turbopack: { root: string };
};

export default nextConfig;
