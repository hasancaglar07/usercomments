import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/src/lib/seo";
import { SUPPORTED_LANGUAGES } from "@/src/lib/i18n";

export default function robots(): MetadataRoute.Robots {
    const siteUrl = getSiteUrl();
    const disallowPaths = [
        "/admin",
        "/user/login",
        "/user/register",
        "/user/settings",
        "/node/add/review",
        "/forgot-password",
        "/health",
    ];

    const rules: MetadataRoute.Robots["rules"] = {
        userAgent: "*",
        allow: SUPPORTED_LANGUAGES.map((lang) => `/${lang}/`),
        disallow: [
            ...disallowPaths,
            ...SUPPORTED_LANGUAGES.flatMap((lang) =>
                disallowPaths.map((path) => `/${lang}${path}`)
            ),
        ],
    };

    return {
        rules,
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
