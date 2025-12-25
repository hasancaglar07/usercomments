import "../../styles/globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { AuthProvider } from "../../components/auth/AuthProvider";
import { isRtlLanguage, localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { getCategories } from "@/src/lib/api";
import { toAbsoluteUrl } from "@/src/lib/seo";
import type { Category } from "@/src/types";

export const runtime = "edge";

const SITE_NAME = "UserReview";
export const metadata: Metadata = {
  title: "UserReview | Real User Reviews & Honest Product Insights",
  description:
    "Read what real people say before you buy. Thousands of user reviews and honest experiences on the latest products.",
  icons: {
    icon: "/favicon.png",
  },
};

export default async function SiteLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang?: string }>;
}>) {
  const resolvedParams = await params;
  const lang = normalizeLanguage(resolvedParams?.lang);
  const dir = isRtlLanguage(lang) ? "rtl" : "ltr";
  let categories: Category[] = [];

  try {
    const allCategories = await getCategories(lang);

    // Exact order and selection from irecommend.ru
    const headerCategoryIds = [930, 932, 929, 937, 934, 936, 935, 940, 941, 938];

    const categoryMap = new Map();
    if (Array.isArray(allCategories)) { // Added Array.isArray check
      allCategories.forEach(cat => categoryMap.set(cat.id, cat));
    }

    categories = headerCategoryIds
      .map(id => categoryMap.get(id))
      .filter(Boolean);

    // If for some reason we have no categories, fallback to all top-level
    if (categories.length === 0) {
      // Fallback removed to prevent unwanted categories (like 'Diğerleri') from appearing
      categories = [];
    }
  } catch (error) {
    console.error("Failed to load header categories", error);
  }

  let websiteJsonLd = {};
  let organizationJsonLd = {};

  try {
    const localizedSiteUrl = toAbsoluteUrl(localizePath("/", lang));
    const searchTarget = toAbsoluteUrl(
      localizePath("/search?q={search_term_string}", lang)
    );

    websiteJsonLd = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${localizedSiteUrl}#website`,
      name: SITE_NAME,
      url: localizedSiteUrl,
      inLanguage: lang,
      potentialAction: {
        "@type": "SearchAction",
        target: searchTarget,
        "query-input": "required name=search_term_string",
      },
    };

    organizationJsonLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${localizedSiteUrl}#organization`,
      name: SITE_NAME,
      url: localizedSiteUrl,
      logo: toAbsoluteUrl("/favicon.png"),
    };
  } catch (error) {
    console.error("Error generating SEO JSON-LD:", error);
  }

  return (
    <html lang={lang} dir={dir} className="light">
      <body>
        <AuthProvider>
          <Script
            src="https://www.googletagmanager.com/gtag/js?id=G-829FXRQW1V"
            strategy="afterInteractive"
          />
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());

                gtag('config', 'G-829FXRQW1V');
              `,
            }}
          />
          <script type="application/ld+json">{JSON.stringify(websiteJsonLd)}</script>
          <script type="application/ld+json">
            {JSON.stringify(organizationJsonLd)}
          </script>
          <Header lang={lang} categories={categories} />
          {children}
          <Footer lang={lang} />
        </AuthProvider>
      </body>
    </html>
  );
}
