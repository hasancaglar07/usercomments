import { getSiteUrl } from "@/src/lib/seo";

export function GET() {
  const siteUrl = getSiteUrl();
  const body = `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
