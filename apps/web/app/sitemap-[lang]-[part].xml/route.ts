import {
  buildLanguageSitemapXml,
  buildUrlset,
  SITEMAP_CACHE_SECONDS,
} from "@/src/lib/sitemap";
import { isSupportedLanguage } from "@/src/lib/i18n";

export const revalidate = 1800;

export async function GET(
  _request: Request,
  context: { params?: Promise<{ lang?: string; part?: string } | undefined> }
) {
  const rawParams = context.params ? await context.params : undefined;
  const langValue = typeof rawParams?.lang === "string" ? rawParams.lang : "";
  const partValue = typeof rawParams?.part === "string" ? rawParams.part : "";
  const part = Number(partValue);

  if (!isSupportedLanguage(langValue) || !Number.isFinite(part) || part <= 1) {
    const empty = buildUrlset([]);
    return new Response(empty, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
      },
    });
  }

  const body = await buildLanguageSitemapXml(langValue, part);
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
    },
  });
}
