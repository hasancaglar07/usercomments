export const runtime = 'edge';

import { getSiteUrl } from "@/src/lib/seo";
import { DEFAULT_LANGUAGE, getLocale, localizePath } from "@/src/lib/i18n";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
    const siteUrl = getSiteUrl();
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    const lang = DEFAULT_LANGUAGE;
    const languageTag = getLocale(lang);
    const pageSize = 20;

    // RSS Header
    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>UserReview.net - Latest Reviews</title>
    <link>${siteUrl}</link>
    <description>Latest user reviews and product ratings.</description>
    <language>${languageTag}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />`;

    if (apiBaseUrl) {
        try {
            // Fetch latest reviews (using sitemap API or similar endpoint if available, 
            // otherwise falling back to a known pattern or just sitemap data would be safer but less rich.
            // Since we want rich RSS, we ideally need titles/descriptions.
            // Let's try to fetch from the same source sitemap uses but maybe we can just use the latest reviews API if strictly needed.
            // However, for simplicity and performance in edge, let's reuse sitemap logic or just fetch a public API endpoint.
            // We will try to fetch the 'latest' reviews from the public API.

            const searchParams = new URLSearchParams({
                sort: "latest",
                page: "1",
                pageSize: String(pageSize),
                lang,
            });
            const response = await fetch(
                `${apiBaseUrl.replace(/\/$/, "")}/api/reviews?${searchParams}`,
                { next: { revalidate: 3600 } }
            );

            if (response.ok) {
                const data = await response.json();
                const items = data.items || [];

                for (const item of items) {
                    const link = `${siteUrl}${localizePath(`/content/${item.slug}`, lang)}`;
                    const title = item.title || "No Title";
                    const desc = item.excerpt || item.title;
                    const pubDate = item.createdAt ? new Date(item.createdAt).toUTCString() : new Date().toUTCString();

                    rss += `
    <item>
      <title><![CDATA[${title}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description><![CDATA[${desc}]]></description>
      <pubDate>${pubDate}</pubDate>
    </item>`;
                }
            }
        } catch (e) {
            console.error("RSS generation error", e);
        }
    }

    rss += `
  </channel>
</rss>`;

    return new Response(rss, {
        headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
    });
}
