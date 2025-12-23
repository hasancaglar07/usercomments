import type { Metadata } from "next";
import { headers } from "next/headers";
import { isRtlLanguage, normalizeLanguage } from "@/src/lib/i18n";

export const metadata: Metadata = {
  title: "UserReview | Real User Reviews & Honest Product Insights",
  description: "Read what real people say before you buy. Thousands of user reviews and honest experiences on the latest products.",
  icons: {
    icon: "/favicon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const lang = normalizeLanguage(headerList.get("x-lang"));
  const dir = isRtlLanguage(lang) ? "rtl" : "ltr";

  return (
    <html lang={lang} dir={dir} className="light">
      <body>{children}</body>
    </html>
  );
}
