import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    // Reduce build worker concurrency to avoid Cloudflare Pages memory limits.
    cpus: 2,
  },
};

export default nextConfig;
