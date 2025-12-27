"use client";

import Link from "next/link";
import AuthCtaButton from "@/components/auth/AuthCtaButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";
import type { Category } from "@/src/types";

type HeaderProps = {
  lang: string;
  categories: Category[];
};

export default function Header({ lang, categories }: HeaderProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const resolvedLang = normalizeLanguage(lang);

  const username =
    user?.user_metadata?.username ||
    user?.email?.split("@")[0] ||
    t(resolvedLang, "header.accountFallback");
  const homeHref = localizePath("/", resolvedLang);
  const searchAction = localizePath("/search", resolvedLang);
  const loginHref = localizePath("/user/login", resolvedLang);
  const addReviewHref = localizePath("/node/add/review", resolvedLang);
  const profileHref = localizePath(
    `/users/${encodeURIComponent(username.toLowerCase())}`,
    resolvedLang
  );

  return (
    <header className="bg-background-light dark:bg-surface-dark border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link
            className="flex items-center gap-2 flex-shrink-0 cursor-pointer active-press"
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
                className="flex items-center justify-center h-10 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-text-main dark:text-white text-sm font-bold rounded-lg transition-colors gap-2 active-press"
                href={profileHref}
              >
                <span className="material-symbols-outlined text-[20px]">account_circle</span>
                <span className="truncate max-w-[100px]">{username}</span>
              </Link>
            ) : (
              <Link
                className="flex items-center justify-center h-10 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-text-main dark:text-white text-sm font-bold rounded-lg transition-colors active-press"
                href={loginHref}
              >
                <span className="truncate">{t(resolvedLang, "header.signIn")}</span>
              </Link>
            )}
          </div>
        </div>
        {categories.length > 0 && (
          <nav className="flex items-center gap-2 py-2 overflow-x-auto no-scrollbar border-t border-gray-100 dark:border-gray-800/50 -mx-4 px-4 md:mx-0 md:px-0 mask-linear-fade">
            {categories.map((category) => (
              <Link
                key={category.id}
                className="flex-shrink-0 px-3 py-1.5 text-[13px] font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-full border border-gray-100 dark:border-gray-700 whitespace-nowrap active:bg-gray-100 dark:active:bg-gray-700 transition-all active-press"
                href={localizePath(`/catalog/reviews/${category.id}`, resolvedLang)}
              >
                {category.name}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
