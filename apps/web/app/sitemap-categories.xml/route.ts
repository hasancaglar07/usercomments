import { getSiteUrl } from "@/src/lib/seo";
import { DEFAULT_LANGUAGE, localizePath } from "@/src/lib/i18n";
import { SITEMAP_CACHE_SECONDS } from "@/src/lib/sitemap";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUrlset(urls: string[]): string {
  const entries = urls
    .map((url) => `<url><loc>${escapeXml(url)}</loc></url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

export async function GET() {
  const siteUrl = getSiteUrl();
  const lang = DEFAULT_LANGUAGE;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const urls: string[] = [
    `${siteUrl}${localizePath("/", lang)}`,
    `${siteUrl}${localizePath("/catalog", lang)}`,
    `${siteUrl}${localizePath("/products", lang)}`,
    `${siteUrl}${localizePath("/contact", lang)}`,
    `${siteUrl}${localizePath("/privacy-policy", lang)}`,
    `${siteUrl}${localizePath("/terms-of-use", lang)}`,
  ];

  if (apiBaseUrl) {
    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/$/, "")}/api/sitemap/categories?lang=${lang}`,
        { next: { revalidate: SITEMAP_CACHE_SECONDS } }
      );
      if (response.ok) {
        const data = await response.json();
        const categories = data.items ?? [];
        for (const category of categories) {
          urls.push(
            `${siteUrl}${localizePath(`/catalog/reviews/${category.id}`, lang)}`
          );
          urls.push(
            `${siteUrl}${localizePath(`/catalog/list/${category.id}`, lang)}`
          );
        }
      }
    } catch {
      // ignore API errors for sitemap
    }
  }

  return new Response(buildUrlset(urls), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
    },
  });
}
