"use client";

import Link from "next/link";
import AuthCtaButton from "@/components/auth/AuthCtaButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

type HeaderCategoryKey =
  | "beauty"
  | "tech"
  | "travel"
  | "health"
  | "auto"
  | "books"
  | "kids"
  | "finance"
  | "movies";

export type HeaderCategoryLinks = Partial<Record<HeaderCategoryKey, string>>;

type HeaderProps = {
  lang: string;
  categoryLinks?: HeaderCategoryLinks;
};

export default function Header({ lang, categoryLinks }: HeaderProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const resolvedLang = normalizeLanguage(lang);

  const username =
    user?.user_metadata?.username ||
    user?.email?.split("@")[0] ||
    t(resolvedLang, "header.accountFallback");
  const homeHref = localizePath("/", resolvedLang);
  const searchAction = localizePath("/search", resolvedLang);
  const catalogHref = localizePath("/catalog", resolvedLang);
  const loginHref = localizePath("/user/login", resolvedLang);
  const addReviewHref = localizePath("/node/add/review", resolvedLang);
  const profileHref = localizePath(
    `/users/${encodeURIComponent(username.toLowerCase())}`,
    resolvedLang
  );
  const resolvedCategoryLinks = categoryLinks ?? {};

  return (
    <header className="bg-background-light dark:bg-surface-dark border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link
            className="flex items-center gap-2 flex-shrink-0 cursor-pointer"
            href={homeHref}
          >
            <span className="material-symbols-outlined text-primary text-3xl">
              forum
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              UserReview
            </h1>
          </Link>
          <div className="hidden md:flex flex-1 max-w-2xl mx-4">
            <form className="relative w-full group" action={searchAction} method="get">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-400">
                  search
                </span>
              </div>
              <input
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg leading-5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition duration-150 ease-in-out"
                name="q"
                placeholder={t(resolvedLang, "header.searchPlaceholder")}
                type="text"
              />
            </form>
          </div>
          <div className="flex items-center gap-3">
            <AuthCtaButton
              as="a"
              className="hidden sm:flex items-center justify-center h-10 px-4 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
              authenticatedHref={addReviewHref}
            >
              <span className="material-symbols-outlined text-[18px] mr-1">
                add
              </span>
              <span className="truncate">{t(resolvedLang, "header.addReview")}</span>
            </AuthCtaButton>

            {loading ? (
              <div className="h-10 w-20 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
            ) : isAuthenticated ? (
              <Link
                className="flex items-center justify-center h-10 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-text-main dark:text-white text-sm font-bold rounded-lg transition-colors gap-2"
                href={profileHref}
              >
                <span className="material-symbols-outlined text-[20px]">account_circle</span>
                <span className="truncate max-w-[100px]">{username}</span>
              </Link>
            ) : (
              <Link
                className="flex items-center justify-center h-10 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-text-main dark:text-white text-sm font-bold rounded-lg transition-colors"
                href={loginHref}
              >
                <span className="truncate">{t(resolvedLang, "header.signIn")}</span>
              </Link>
            )}
          </div>
        </div>
        <nav className="hidden md:flex gap-8 py-3 overflow-x-auto hide-scrollbar border-t border-gray-100 dark:border-gray-800">
          <Link
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap"
            href={resolvedCategoryLinks.beauty ?? catalogHref}
          >
            {t(resolvedLang, "header.nav.beauty")}
          </Link>
          <Link
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap"
            href={resolvedCategoryLinks.tech ?? catalogHref}
          >
            {t(resolvedLang, "header.nav.tech")}
          </Link>
          <Link
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap"
            href={resolvedCategoryLinks.travel ?? catalogHref}
          >
            {t(resolvedLang, "header.nav.travel")}
          </Link>
          <Link
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap"
            href={resolvedCategoryLinks.health ?? catalogHref}
          >
            {t(resolvedLang, "header.nav.health")}
          </Link>
          <Link
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap"
            href={resolvedCategoryLinks.auto ?? catalogHref}
          >
            {t(resolvedLang, "header.nav.auto")}
          </Link>
          <Link
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap"
            href={resolvedCategoryLinks.books ?? catalogHref}
          >
            {t(resolvedLang, "header.nav.books")}
          </Link>
          <Link
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap"
            href={resolvedCategoryLinks.kids ?? catalogHref}
          >
            {t(resolvedLang, "header.nav.kids")}
          </Link>
          <Link
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap"
            href={resolvedCategoryLinks.finance ?? catalogHref}
          >
            {t(resolvedLang, "header.nav.finance")}
          </Link>
          <Link
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap"
            href={resolvedCategoryLinks.movies ?? catalogHref}
          >
            {t(resolvedLang, "header.nav.movies")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
