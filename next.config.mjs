import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: workspaceRoot,
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
