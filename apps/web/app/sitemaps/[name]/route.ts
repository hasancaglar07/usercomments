
import { buildLanguageSitemapXml, buildUrlset, SITEMAP_CACHE_SECONDS, SITEMAP_PAGE_SIZE } from "@/src/lib/sitemap";
import { isSupportedLanguage, localizePath, type SupportedLanguage } from "@/src/lib/i18n";
import { getSiteUrl } from "@/src/lib/seo";

export const dynamic = "force-dynamic";
export const runtime = 'edge';
export const revalidate = 1800;

export async function GET(
    _request: Request,
    context: { params: Promise<{ name: string }> }
) {
    const { name } = await context.params;

    // Regex patterns
    // sitemap-en.xml
    const langMatch = name.match(/^sitemap-([a-z]{2})\.xml$/);
    // sitemap-en-2.xml
    const langPartMatch = name.match(/^sitemap-([a-z]{2})-(\d+)\.xml$/);
    // sitemap-products-en.xml
    const productMatch = name.match(/^sitemap-products-([a-z]{2})\.xml$/);
    // sitemap-products-en-2.xml
    const productPartMatch = name.match(/^sitemap-products-([a-z]{2})-(\d+)\.xml$/);

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    try {
        // 1. General + Reviews (Part 1)
        if (langMatch) {
            const lang = langMatch[1] as SupportedLanguage;
            if (!isSupportedLanguage(lang)) return emptyResponse();
            const body = await buildLanguageSitemapXml(lang, 1);
            return xmlResponse(body);
        }

        // 2. Reviews (Part N)
        if (langPartMatch) {
            const lang = langPartMatch[1] as SupportedLanguage;
            const part = parseInt(langPartMatch[2], 10);
            if (!isSupportedLanguage(lang) || isNaN(part)) return emptyResponse();
            const body = await buildLanguageSitemapXml(lang, part);
            return xmlResponse(body);
        }

        // 3. Products (Part 1 or N)
        if (productMatch || productPartMatch) {
            const lang = ((productMatch ? productMatch[1] : productPartMatch?.[1]) ?? "") as SupportedLanguage;
            const part = productMatch ? 1 : parseInt(productPartMatch?.[2] ?? "1", 10);

            if (!isSupportedLanguage(lang)) return emptyResponse();
            if (!apiBaseUrl) return emptyResponse();

            const response = await fetch(
                `${apiBaseUrl.replace(/\/$/, "")}/api/sitemap/products?lang=${lang}&part=${part}&pageSize=${SITEMAP_PAGE_SIZE}`,
                { next: { revalidate: SITEMAP_CACHE_SECONDS } }
            );

            if (!response.ok) return emptyResponse();

            const data = await response.json();
            const siteUrl = getSiteUrl();
            const entries = (data.items ?? []).map(
                (item: {
                    slug: string;
                    updatedAt?: string | null;
                    createdAt?: string;
                    imageUrls?: string[];
                }) => ({
                    loc: `${siteUrl}${localizePath(`/products/${item.slug}`, lang)}`,
                    lastmod: item.updatedAt ?? item.createdAt ?? undefined,
                    images: Array.isArray(item.imageUrls) ? item.imageUrls : undefined,
                })
            );

            return xmlResponse(buildUrlset(entries));
        }
    } catch (error) {
        console.error("Sitemap generation error:", error);
        return emptyResponse();
    }

    return emptyResponse();
}

function emptyResponse() {
    return xmlResponse(buildUrlset([]));
}

function xmlResponse(body: string) {
    return new Response(body, {
        headers: {
            "Content-Type": "application/xml",
            "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=600`,
        },
    });
}
