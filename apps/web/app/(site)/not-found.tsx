import Link from "next/link";
import { headers } from "next/headers";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

export default async function NotFound() {
  const requestHeaders = await headers();
  const headerLang = requestHeaders.get("x-lang");
  const lang = normalizeLanguage(headerLang);
  const homeHref = localizePath("/", lang);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">

      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
        <span className="relative material-symbols-outlined text-[120px] text-primary animate-pulse">
          location_off
        </span>
      </div>

      <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
        404
      </h1>
      <h2 className="text-xl md:text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-6">
        {t(lang, "notFound.title" as any) || "Page not found"}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-10 leading-relaxed">
        {t(lang, "notFound.description" as any) || "The page you are looking for might have been removed, had its name changed, or is temporarily unavailable."}
      </p>

      <Link
        href={homeHref}
        className="shine-effect flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-full font-bold transition-all hover:-translate-y-1 shadow-lg shadow-primary/25 active-press"
      >
        <span className="material-symbols-outlined">home</span>
        {t(lang, "notFound.backHome" as any) || "Back to Homepage"}
      </Link>

    </div>
  );
}
