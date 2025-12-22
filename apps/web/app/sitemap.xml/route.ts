export const runtime = "edge";
import { getSiteUrl } from "@/src/lib/seo";

const SITEMAP_PAGE_SIZE = 5000;
const REVALIDATE_SECONDS = 300;

export const revalidate = 300;

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

  if (apiBaseUrl) {
    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/$/, "")}/api/sitemap/reviews?part=1&pageSize=${SITEMAP_PAGE_SIZE}`,
        { next: { revalidate: REVALIDATE_SECONDS } }
      );
      if (response.ok) {
        const data = await response.json();
        const totalPages =
          typeof data?.pageInfo?.totalPages === "number"
            ? data.pageInfo.totalPages
            : Number(data?.pageInfo?.totalPages ?? 0);
        for (let part = 1; part <= totalPages; part += 1) {
          sitemapUrls.push(`${siteUrl}/sitemap-reviews-${part}.xml`);
        }
      }
    } catch {
      // ignore API errors for sitemap index
    }
  }

  sitemapUrls.push(`${siteUrl}/sitemap-categories.xml`);

  const body = buildSitemapIndex(sitemapUrls);

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
