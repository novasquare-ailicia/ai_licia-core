import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  output: "export",
  turbopack: {
    root: projectRoot,
  },
} as NextConfig & { turbopack: { root: string } };

export default nextConfig;
