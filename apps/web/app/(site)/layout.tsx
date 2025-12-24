import "../../styles/globals.css";
import type { Metadata } from "next";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { AuthProvider } from "../../components/auth/AuthProvider";
import { isRtlLanguage, localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { getCategories } from "@/src/lib/api";
import { toAbsoluteUrl } from "@/src/lib/seo";
import type { Category } from "@/src/types";

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

  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    try {
      const allCategories = await getCategories(lang);
      // Filter for top-level categories only
      categories = allCategories.filter((category) => category.parentId == null);
    } catch (error) {
      console.error("Failed to load header categories", error);
    }
  }

  const localizedSiteUrl = toAbsoluteUrl(localizePath("/", lang));
  const searchTarget = toAbsoluteUrl(
    localizePath("/search?q={search_term_string}", lang)
  );
  const websiteJsonLd = {
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
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${localizedSiteUrl}#organization`,
    name: SITE_NAME,
    url: localizedSiteUrl,
    logo: toAbsoluteUrl("/favicon.png"),
  };

  return (
    <html lang={lang} dir={dir} className="light">
      <body>
        <AuthProvider>
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
