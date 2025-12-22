export const runtime = "edge";
import { getSiteUrl } from "@/src/lib/seo";

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

function buildUrlset(urls: string[]): string {
  const entries = urls
    .map((url) => `<url><loc>${escapeXml(url)}</loc></url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

export async function GET() {
  const siteUrl = getSiteUrl();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const urls: string[] = [
    `${siteUrl}/`,
    `${siteUrl}/catalog`,
    `${siteUrl}/contact`,
    `${siteUrl}/privacy-policy`,
    `${siteUrl}/terms-of-use`,
  ];

  if (apiBaseUrl) {
    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/$/, "")}/api/sitemap/categories`,
        { next: { revalidate: REVALIDATE_SECONDS } }
      );
      if (response.ok) {
        const data = await response.json();
        const categories = data.items ?? [];
        for (const category of categories) {
          urls.push(`${siteUrl}/catalog/reviews/${category.id}`);
        }
      }
    } catch {
      // ignore API errors for sitemap
    }
  }

  return new Response(buildUrlset(urls), {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
