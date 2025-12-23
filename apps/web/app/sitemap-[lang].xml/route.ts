import {
  buildLanguageSitemapXml,
  buildUrlset,
  SITEMAP_CACHE_SECONDS,
} from "@/src/lib/sitemap";
import { isSupportedLanguage } from "@/src/lib/i18n";

export const revalidate = 1800;

export async function GET(
  _request: Request,
  context: { params?: Promise<{ lang?: string } | undefined> }
) {
  const rawParams = context.params ? await context.params : undefined;
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
