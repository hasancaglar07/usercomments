import "../../styles/globals.css";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { AuthProvider } from "../../components/auth/AuthProvider";
import { normalizeLanguage } from "@/src/lib/i18n";

export default async function SiteLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params?: Promise<{ lang?: string }>;
}>) {
  const resolvedParams = await (params ?? Promise.resolve({} as { lang?: string }));
  const lang = normalizeLanguage(resolvedParams?.lang);

  return (
    <AuthProvider>
      <Header lang={lang} />
      {children}
      <Footer lang={lang} />
    </AuthProvider>
  );
}
