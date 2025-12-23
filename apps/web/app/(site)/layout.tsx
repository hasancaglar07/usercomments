import "../../styles/globals.css";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { AuthProvider } from "../../components/auth/AuthProvider";
import { normalizeLanguage } from "@/src/lib/i18n";
import { getCategories } from "@/src/lib/api";
import type { Category } from "@/src/types";

export default async function SiteLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params?: Promise<{ lang?: string }>;
}>) {
  const resolvedParams = await (params ?? Promise.resolve({} as { lang?: string }));
  const lang = normalizeLanguage(resolvedParams?.lang);
  let headerCategories: Category[] = [];

  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    try {
      headerCategories = await getCategories(lang);
    } catch (error) {
      console.error("Failed to load header categories", error);
    }
  }

  return (
    <AuthProvider>
      <Header lang={lang} categories={headerCategories} />
      {children}
      <Footer lang={lang} />
    </AuthProvider>
  );
}
