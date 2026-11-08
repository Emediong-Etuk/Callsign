import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // shared/flags.json lives one level up (shared with the Rust contract).
  turbopack: { root: path.join(import.meta.dirname, "..") },
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  poweredByHeader: false,
};

export default nextConfig;
