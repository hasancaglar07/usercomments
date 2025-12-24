import { getSiteUrl } from "@/src/lib/seo";
import type { NextRequest } from "next/server";
import { DEFAULT_LANGUAGE, localizePath } from "@/src/lib/i18n";
import { buildUrlset, SITEMAP_CACHE_SECONDS, SITEMAP_PAGE_SIZE } from "@/src/lib/sitemap";

export const dynamic = "force-static";
export const revalidate = 1800;

export function generateStaticParams() {
  return [];
}

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ part?: string }> }
) {
  const siteUrl = getSiteUrl();
  const lang = DEFAULT_LANGUAGE;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const params = await props.params;
  const part = Number(params?.part ?? 0);

  if (!apiBaseUrl || !Number.isFinite(part) || part <= 0) {
    return new Response(buildUrlset([]), {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
      },
    });
  }

  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, "")}/api/sitemap/reviews?lang=${lang}&part=${part}&pageSize=${SITEMAP_PAGE_SIZE}`,
    { next: { revalidate: SITEMAP_CACHE_SECONDS } }
  );

  if (!response.ok) {
    return new Response(buildUrlset([]), {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
      },
    });
  }

  const data = await response.json();
  const urls = (
    data.items ?? []
  ).map(
    (item: {
      slug: string;
      updatedAt?: string | null;
      createdAt?: string;
      imageUrls?: string[];
    }) => ({
      loc: `${siteUrl}${localizePath(`/content/${item.slug}`, lang)}`,
      lastmod: item.updatedAt ?? item.createdAt,
      images: Array.isArray(item.imageUrls) ? item.imageUrls : undefined,
    })
  );

  return new Response(buildUrlset(urls), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
    },
  });
}
