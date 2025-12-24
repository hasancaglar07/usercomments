import { buildUrlset, SITEMAP_CACHE_SECONDS, SITEMAP_PAGE_SIZE } from "@/src/lib/sitemap";
import { isSupportedLanguage, localizePath } from "@/src/lib/i18n";
import { getSiteUrl } from "@/src/lib/seo";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

export async function GET(
  _request: Request,
  context: { params: Promise<{ lang?: string; part?: string }> }
) {
  const rawParams = await context.params;
  const langValue = typeof rawParams?.lang === "string" ? rawParams.lang : "";
  const partValue = typeof rawParams?.part === "string" ? rawParams.part : "";
  const part = Number(partValue);

  if (!isSupportedLanguage(langValue) || !Number.isFinite(part) || part <= 1) {
    const empty = buildUrlset([]);
    return new Response(empty, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
      },
    });
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    const empty = buildUrlset([]);
    return new Response(empty, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
      },
    });
  }

  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, "")}/api/sitemap/products?lang=${langValue}&part=${part}&pageSize=${SITEMAP_PAGE_SIZE}`,
    { next: { revalidate: SITEMAP_CACHE_SECONDS } }
  );

  if (!response.ok) {
    const empty = buildUrlset([]);
    return new Response(empty, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
      },
    });
  }

  const data = await response.json();
  const siteUrl = getSiteUrl();
  const entries = (
    data.items ?? []
  ).map(
    (item: {
      slug: string;
      updatedAt?: string | null;
      createdAt?: string;
      imageUrls?: string[];
    }) => ({
      loc: `${siteUrl}${localizePath(`/products/${item.slug}`, langValue)}`,
      lastmod: item.updatedAt ?? item.createdAt,
      images: Array.isArray(item.imageUrls) ? item.imageUrls : undefined,
    })
  );

  return new Response(buildUrlset(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
    },
  });
}
