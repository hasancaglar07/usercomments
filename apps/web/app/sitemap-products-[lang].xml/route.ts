import { buildUrlset, SITEMAP_CACHE_SECONDS, SITEMAP_PAGE_SIZE } from "@/src/lib/sitemap";
import { isSupportedLanguage, localizePath, SUPPORTED_LANGUAGES } from "@/src/lib/i18n";
import { getSiteUrl } from "@/src/lib/seo";

export const dynamic = "force-static";
export const revalidate = 1800;

export function generateStaticParams() {
  return SUPPORTED_LANGUAGES.map((lang) => ({ lang }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ lang?: string }> }
) {
  const rawParams = await context.params;
  const langValue = typeof rawParams?.lang === "string" ? rawParams.lang : "";

  if (!isSupportedLanguage(langValue)) {
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
    `${apiBaseUrl.replace(/\/$/, "")}/api/sitemap/products?lang=${langValue}&part=1&pageSize=${SITEMAP_PAGE_SIZE}`,
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
  const entries = (data.items ?? []).map((item: { slug: string; updatedAt?: string | null; createdAt?: string }) => ({
    loc: `${siteUrl}${localizePath(`/products/${item.slug}`, langValue)}`,
    lastmod: item.updatedAt ?? item.createdAt,
  }));

  return new Response(buildUrlset(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
    },
  });
}
