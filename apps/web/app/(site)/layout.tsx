import "../../styles/globals.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { Inter } from "next/font/google"; // Import Font
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { Providers } from "../../components/Providers";
import { isRtlLanguage, localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { getCategories } from "@/src/lib/api";
import { toAbsoluteUrl } from "@/src/lib/seo";
import type { Category } from "@/src/types";

// Initialize Font
const inter = Inter({ subsets: ["latin"], display: "swap" });

const SITE_NAME = "UserReview";

export const runtime = 'edge';

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
  const requestHeaders = await headers();
  const headerLang = requestHeaders.get("x-lang");
  const lang = normalizeLanguage(resolvedParams?.lang ?? headerLang);
  const dir = isRtlLanguage(lang) ? "rtl" : "ltr";
  let categories: Category[] = [];

  try {
    // Add timeout to prevent hanging on Edge Runtime
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
    <html lang={lang} dir={dir} className={`light ${inter.className}`}>
      <body>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap&text=account_circle,add_circle,analytics,chat_bubble,check,chevron_left,chevron_right,close,cloud_upload,cookie,dataset,delete,diamond,do_not_disturb_on,error,expand_more,flag,forum,gavel,group,history_edu,info,link,lock,mail,military_tech,person,rate_review,remove_circle,sentiment_dissatisfied,share,star,thumb_up,verified,visibility"
        />
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
          <Header lang={lang} categories={categories} />
          {children}
          <Footer lang={lang} />
        </Providers>
      </body>
    </html>
  );
}
