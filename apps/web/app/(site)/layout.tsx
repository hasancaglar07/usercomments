import "../../styles/globals.css";
import { plusJakartaSans } from "@/src/lib/fonts";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import CookieConsent from "@/components/layout/CookieConsent";
import ScrollToTop from "@/components/ui/ScrollToTop";
import { Providers } from "@/components/Providers";

import { getCategories } from "@/src/lib/api";
import { isRtlLanguage, localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { toAbsoluteUrl } from "@/src/lib/seo";
import type { Category } from "@/src/types";

const SITE_NAME = "UserReview";

export const viewport: Viewport = {
  themeColor: "#137fec",
};

export const metadata: Metadata = {
  title: "UserReview | Real User Reviews & Honest Product Insights",
  description:
    "Read what real people say before you buy. Thousands of user reviews and honest experiences on the latest products.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
  },
  other: {
    "google-adsense-account": "ca-pub-8614212887540857",
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
    // Add timeout to prevent hanging on upstream API calls
    const allCategories = await Promise.race([
      getCategories(lang),
      new Promise<Category[]>((_, reject) =>
        setTimeout(() => reject(new Error('Categories API timeout')), 15000)
      )
    ]);

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
    // Ensure we continue rendering with empty categories
    categories = [];
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
      sameAs: [
        "https://twitter.com/UserReviewNet",
        "https://www.facebook.com/UserReviewNet",
        "https://www.instagram.com/UserReviewNet",
      ],
    };
  } catch (error) {
    console.error("Error generating SEO JSON-LD:", error);
  }

  return (
    <html lang={lang} dir={dir} className={`light font-display ${plusJakartaSans.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body>
        <Providers>

          {/* Google Analytics - works in all environments */}
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
          {/* AdSense - only in production to avoid data-nscript warning */}
          {process.env.NODE_ENV === "production" && (
            <Script
              async
              src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8614212887540857"
              crossOrigin="anonymous"
              strategy="lazyOnload"
            />
          )}
          {/* Google News SWG - only in production (CORS blocks localhost) */}
          {process.env.NODE_ENV === "production" && (
            <>
              <Script
                src="https://news.google.com/swg/js/v1/swg-basic.js"
                strategy="afterInteractive"
                type="application/javascript"
              />
              <Script
                id="google-publisher-center"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                  __html: `
                    (self.SWG_BASIC = self.SWG_BASIC || []).push( basicSubscriptions => {
                      basicSubscriptions.init({
                        type: "NewsArticle",
                        isPartOfType: ["Product"],
                        isPartOfProductId: "CAowsOzEDA:openaccess",
                        clientOptions: { theme: "light", lang: "${lang}" },
                      });
                    });
                  `,
                }}
              />
            </>
          )}
          <script type="application/ld+json">{JSON.stringify(websiteJsonLd)}</script>
          <script type="application/ld+json">
            {JSON.stringify(organizationJsonLd)}
          </script>
          <div className="flex min-h-screen flex-col">
            <Header lang={lang} categories={categories} />
            <main className="flex-1">{children}</main>
            <Footer lang={lang} />
          </div>
          <CookieConsent lang={lang} />
          <ScrollToTop />
        </Providers>
      </body>
    </html>
  );
}

