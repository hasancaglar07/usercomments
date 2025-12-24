import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    runtime: "edge",
    cpus: 2,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
