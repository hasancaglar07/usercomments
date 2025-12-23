import { getSiteUrl } from "@/src/lib/seo";
import { localizePath, type SupportedLanguage } from "@/src/lib/i18n";

export const SITEMAP_PAGE_SIZE = 50000;
export const SITEMAP_CACHE_SECONDS = 1800;

type SitemapEntry = {
  loc: string;
  lastmod?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildUrlset(entries: SitemapEntry[]): string {
  const xmlEntries = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : "";
      return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmod}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${xmlEntries}</urlset>`;
}

export async function buildLanguageSitemapXml(
  lang: SupportedLanguage,
  part: number
): Promise<string> {
  const siteUrl = getSiteUrl();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const entries: SitemapEntry[] = [];

  if (part === 1) {
    entries.push({ loc: `${siteUrl}${localizePath("/", lang)}` });
    entries.push({ loc: `${siteUrl}${localizePath("/catalog", lang)}` });
    entries.push({ loc: `${siteUrl}${localizePath("/products", lang)}` });
  }

  if (!apiBaseUrl) {
    return buildUrlset(entries);
  }

  if (part === 1) {
    try {
      const categoryResponse = await fetch(
        `${apiBaseUrl.replace(/\/$/, "")}/api/sitemap/categories?lang=${lang}`,
        { next: { revalidate: SITEMAP_CACHE_SECONDS } }
      );
      if (categoryResponse.ok) {
        const data = await categoryResponse.json();
        const categories = data.items ?? [];
        for (const category of categories) {
          entries.push({
            loc: `${siteUrl}${localizePath(
              `/catalog/reviews/${category.id}`,
              lang
            )}`,
          });
          entries.push({
            loc: `${siteUrl}${localizePath(
              `/catalog/list/${category.id}`,
              lang
            )}`,
          });
        }
      }
    } catch {
      // ignore API errors for sitemap categories
    }
  }

  try {
    const reviewResponse = await fetch(
      `${apiBaseUrl.replace(/\/$/, "")}/api/sitemap/reviews?lang=${lang}&part=${part}&pageSize=${SITEMAP_PAGE_SIZE}`,
      { next: { revalidate: SITEMAP_CACHE_SECONDS } }
    );
    if (reviewResponse.ok) {
      const data = await reviewResponse.json();
      const reviews = data.items ?? [];
      for (const review of reviews) {
        entries.push({
          loc: `${siteUrl}${localizePath(`/content/${review.slug}`, lang)}`,
          lastmod: review.updatedAt ?? review.createdAt,
        });
      }
    }
  } catch {
    // ignore API errors for sitemap reviews
  }

  return buildUrlset(entries);
}
