import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 2,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    return [
      // Sitemap Rewrites - Route to Worker API
      // Order matters: more specific patterns first
      {
        source: "/sitemap.xml",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/sitemap.xml`,
      },
      {
        source: "/sitemap-categories-:lang.xml",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/sitemap-categories-:lang.xml`,
      },
      {
        source: "/sitemap-products-:lang-:part.xml",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/sitemap-products-:lang-:part.xml`,
      },
      {
        source: "/sitemap-:lang-:part.xml",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/sitemap-:lang-:part.xml`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/stitch_assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/favicon.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Sitemap caching headers for optimal bot performance
      {
        source: "/sitemap:path*.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
          },
          {
            key: "Content-Type",
            value: "application/xml; charset=utf-8",
          },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
