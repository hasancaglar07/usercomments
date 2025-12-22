import { getSiteUrl } from "@/src/lib/seo";
import type { NextRequest } from "next/server";

const SITEMAP_PAGE_SIZE = 5000;
const REVALIDATE_SECONDS = 300;

export const revalidate = 300;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUrlset(urls: Array<{ loc: string; lastmod?: string }>): string {
  const entries = urls
    .map((item) => {
      const lastmod = item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : "";
      return `<url><loc>${escapeXml(item.loc)}</loc>${lastmod}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

export async function GET(
  _request: NextRequest,
  context: { params?: Promise<{ part?: string } | undefined> }
) {
  const siteUrl = getSiteUrl();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const rawParams = context.params ? await context.params : undefined;
  const partValue = typeof rawParams?.part === "string" ? rawParams.part : "";
  const part = Number(partValue);

  if (!apiBaseUrl || !Number.isFinite(part) || part <= 0) {
    return new Response(buildUrlset([]), {
      headers: { "Content-Type": "application/xml" },
    });
  }

  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, "")}/api/sitemap/reviews?part=${part}&pageSize=${SITEMAP_PAGE_SIZE}`,
    { next: { revalidate: REVALIDATE_SECONDS } }
  );

  if (!response.ok) {
    return new Response(buildUrlset([]), {
      headers: { "Content-Type": "application/xml" },
    });
  }

  const data = await response.json();
  const urls = (data.items ?? []).map((item: { slug: string; updatedAt?: string | null; createdAt?: string }) => ({
    loc: `${siteUrl}/content/${item.slug}`,
    lastmod: item.updatedAt ?? item.createdAt,
  }));

  return new Response(buildUrlset(urls), {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
