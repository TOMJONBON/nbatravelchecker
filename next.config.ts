import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the build deterministic and fast; no remote image loaders are required.
  images: { unoptimized: true },
  turbopack: {},
};

export default nextConfig;
