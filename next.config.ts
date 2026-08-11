import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default function nextConfig(phase: string): NextConfig {
  return {
    output: 'export',
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next' : 'dist',
    devIndicators: false,
    outputFileTracingRoot: configDir,
    turbopack: {
      root: configDir,
    },
    images: {
      unoptimized: true,
    },
  };
}
