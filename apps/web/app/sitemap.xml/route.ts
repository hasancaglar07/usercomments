import { getSiteUrl } from "@/src/lib/seo";
import { SUPPORTED_LANGUAGES } from "@/src/lib/i18n";
import { SITEMAP_CACHE_SECONDS, SITEMAP_PAGE_SIZE } from "@/src/lib/sitemap";

export const dynamic = "force-dynamic";
export const runtime = 'edge';
export const revalidate = 1800;

function buildSitemapIndex(urls: string[]): string {
  const entries = urls
    .map((url) => `<sitemap><loc>${url}</loc></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
}

export async function GET() {
  const siteUrl = getSiteUrl();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const sitemapUrls: string[] = [];

  for (const lang of SUPPORTED_LANGUAGES) {
    let reviewPages = 1;
    let productPages = 1;
    if (apiBaseUrl) {
      try {
        const response = await fetch(
          `${apiBaseUrl.replace(/\/$/, "")}/api/sitemap/reviews?lang=${lang}&part=1&pageSize=${SITEMAP_PAGE_SIZE}`,
          { next: { revalidate: SITEMAP_CACHE_SECONDS } }
        );
        if (response.ok) {
          const data = await response.json();
          const rawTotal = data?.pageInfo?.totalPages ?? 1;
          const parsed =
            typeof rawTotal === "number" ? rawTotal : Number(rawTotal ?? 1);
          reviewPages = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
        }
      } catch {
        // ignore API errors for sitemap index
      }

      try {
        const response = await fetch(
          `${apiBaseUrl.replace(/\/$/, "")}/api/sitemap/products?lang=${lang}&part=1&pageSize=${SITEMAP_PAGE_SIZE}`,
          { next: { revalidate: SITEMAP_CACHE_SECONDS } }
        );
        if (response.ok) {
          const data = await response.json();
          const rawTotal = data?.pageInfo?.totalPages ?? 1;
          const parsed =
            typeof rawTotal === "number" ? rawTotal : Number(rawTotal ?? 1);
          productPages = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
        }
      } catch {
        // ignore API errors for sitemap index
      }
    }

    sitemapUrls.push(`${siteUrl}/sitemap-${lang}.xml`);
    if (reviewPages > 1) {
      for (let part = 2; part <= reviewPages; part += 1) {
        sitemapUrls.push(`${siteUrl}/sitemap-${lang}-${part}.xml`);
      }
    }
    sitemapUrls.push(`${siteUrl}/sitemap-products-${lang}.xml`);
    if (productPages > 1) {
      for (let part = 2; part <= productPages; part += 1) {
        sitemapUrls.push(`${siteUrl}/sitemap-products-${lang}-${part}.xml`);
      }
    }
  }

  const body = buildSitemapIndex(sitemapUrls);

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
    },
  });
}
