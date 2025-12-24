import {
  buildLanguageSitemapXml,
  buildUrlset,
  SITEMAP_CACHE_SECONDS,
} from "@/src/lib/sitemap";
import { isSupportedLanguage, SUPPORTED_LANGUAGES } from "@/src/lib/i18n";

export const runtime = "edge";
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

  const body = await buildLanguageSitemapXml(langValue, 1);
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
    },
  });
}
