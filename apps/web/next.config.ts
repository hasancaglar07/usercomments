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
      // Sitemap Rewrites - Proxy directly to Worker API for max performance
      {
        source: "/sitemap.xml",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/sitemap.xml?origin=https://userreview.net&webUrls=true`,
      },
      {
        source: "/sitemap-:slug.xml",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/sitemap-:slug.xml?origin=https://userreview.net&webUrls=true`,
      },
      {
        source: "/sitemap-products:slug*",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/sitemap-products:slug*?origin=https://userreview.net&webUrls=true`
      },
      {
        source: "/sitemap-reviews:slug*",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/sitemap-reviews:slug*?origin=https://userreview.net&webUrls=true`
      },
      {
        source: "/sitemap-categories.xml",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/sitemap-categories.xml?origin=https://userreview.net&webUrls=true`
      }
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
    ];
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
