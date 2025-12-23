import { getSiteUrl } from "@/src/lib/seo";
import { SUPPORTED_LANGUAGES } from "@/src/lib/i18n";

export function GET() {
  const siteUrl = getSiteUrl();
  const allowLines = SUPPORTED_LANGUAGES.map((lang) => `Allow: /${lang}/`).join("\n");
  const disallowPaths = [
    "/admin",
    "/user/login",
    "/user/register",
    "/user/settings",
    "/node/add/review",
    "/forgot-password",
  ];
  const disallowLines = [
    ...disallowPaths.map((path) => `Disallow: ${path}`),
    ...SUPPORTED_LANGUAGES.flatMap((lang) =>
      disallowPaths.map((path) => `Disallow: /${lang}${path}`)
    ),
  ].join("\n");
  const body = `User-agent: *\n${allowLines}\n${disallowLines}\nSitemap: ${siteUrl}/sitemap.xml\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
