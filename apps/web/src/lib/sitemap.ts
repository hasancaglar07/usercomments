import { getSiteUrl } from "@/src/lib/seo";
import { localizePath, type SupportedLanguage } from "@/src/lib/i18n";

export const SITEMAP_PAGE_SIZE = 1000;
export const SITEMAP_CACHE_SECONDS = 600;

export type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

type SitemapImage = {
  loc: string;
  title?: string;
  caption?: string;
};

export type SitemapEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: ChangeFreq;
  priority?: number;
  images?: (string | SitemapImage)[];
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
  const hasImages = entries.some((entry) => entry.images && entry.images.length > 0);
  const xmlEntries = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : "";
      const changefreq = entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : "";
      const priority = entry.priority !== undefined ? `<priority>${entry.priority.toFixed(1)}</priority>` : "";

      const images = entry.images?.length
        ? entry.images
          .map((image) => {
            if (typeof image === "string") {
              return `<image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`;
            }
            // Structured image
            let imgXml = `<image:loc>${escapeXml(image.loc)}</image:loc>`;
            if (image.title) {
              imgXml += `<image:title>${escapeXml(image.title)}</image:title>`;
            }
            if (image.caption) {
              imgXml += `<image:caption>${escapeXml(image.caption)}</image:caption>`;
            }
            return `<image:image>${imgXml}</image:image>`;
          })
          .join("")
        : "";
      return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmod}${changefreq}${priority}${images}</url>`;
    })
    .join("");
  const imageNamespace = hasImages
    ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNamespace}>${xmlEntries}</urlset>`;
}

export async function buildLanguageSitemapXml(
  lang: SupportedLanguage,
  part: number
): Promise<string> {
  const siteUrl = getSiteUrl();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const entries: SitemapEntry[] = [];

  if (part === 1) {
    entries.push({ loc: `${siteUrl}${localizePath("/", lang)}`, priority: 1.0, changefreq: "daily" });
    entries.push({ loc: `${siteUrl}${localizePath("/catalog", lang)}`, priority: 0.9, changefreq: "daily" });
    entries.push({ loc: `${siteUrl}${localizePath("/products", lang)}`, priority: 0.9, changefreq: "daily" });
    entries.push({ loc: `${siteUrl}${localizePath("/contact", lang)}`, priority: 0.5, changefreq: "monthly" });
    entries.push({ loc: `${siteUrl}${localizePath("/privacy-policy", lang)}`, priority: 0.3, changefreq: "yearly" });
    entries.push({ loc: `${siteUrl}${localizePath("/terms-of-use", lang)}`, priority: 0.3, changefreq: "yearly" });
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
            changefreq: "weekly",
            priority: 0.8
          });
          entries.push({
            loc: `${siteUrl}${localizePath(
              `/catalog/list/${category.id}`,
              lang
            )}`,
            changefreq: "weekly",
            priority: 0.8
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
          changefreq: "weekly",
          priority: 0.7,
          images: Array.isArray(review.imageUrls) ? review.imageUrls : undefined,
        });
      }
    }
  } catch {
    // ignore API errors for sitemap reviews
  }

  return buildUrlset(entries);
}
