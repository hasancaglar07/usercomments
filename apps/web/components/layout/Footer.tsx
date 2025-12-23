import Link from "next/link";
import AuthCtaButton from "@/components/auth/AuthCtaButton";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

type FooterProps = {
  lang: string;
};

export default function Footer({ lang }: FooterProps) {
  const resolvedLang = normalizeLanguage(lang);
  const homeHref = localizePath("/", lang);
  const catalogHref = localizePath("/catalog", lang);
  const topRatedHref = localizePath("/catalog?sort=rating", lang);
  const recentHref = localizePath("/catalog?sort=latest", lang);
  const leaderboardHref = localizePath("/catalog?sort=popular", lang);
  const termsHref = localizePath("/terms-of-use", lang);
  const contactHref = localizePath("/contact", lang);
  const addReviewHref = localizePath("/node/add/review", lang);

  return (
    <footer className="bg-background-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 mt-12 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1">
            <Link className="flex items-center gap-2 mb-4" href={homeHref}>
              <span className="material-symbols-outlined text-primary text-2xl">
                forum
              </span>
              <h2 className="text-xl font-bold text-text-main dark:text-white">
                UserReview
              </h2>
            </Link>
            <p className="text-sm text-text-muted mb-4 italic">
              {t(resolvedLang, "footer.tagline")}
            </p>
            <p className="text-sm text-text-muted mb-4">
              {t(resolvedLang, "footer.description")}
            </p>
            <div className="flex gap-4">
              <a
                className="text-gray-400 hover:text-primary transition-colors"
                href="https://facebook.com"
                rel="noreferrer"
                target="_blank"
              >
                <span className="sr-only">{t(resolvedLang, "footer.social.facebook")}</span>FB
              </a>
              <a
                className="text-gray-400 hover:text-primary transition-colors"
                href="https://twitter.com"
                rel="noreferrer"
                target="_blank"
              >
                <span className="sr-only">{t(resolvedLang, "footer.social.twitter")}</span>TW
              </a>
              <a
                className="text-gray-400 hover:text-primary transition-colors"
                href="https://instagram.com"
                rel="noreferrer"
                target="_blank"
              >
                <span className="sr-only">{t(resolvedLang, "footer.social.instagram")}</span>IG
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-main dark:text-white uppercase tracking-wider mb-4">
              {t(resolvedLang, "footer.explore")}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={catalogHref}
                >
                  {t(resolvedLang, "footer.categories")}
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={topRatedHref}
                >
                  {t(resolvedLang, "footer.topRated")}
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={recentHref}
                >
                  {t(resolvedLang, "footer.recentReviews")}
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={leaderboardHref}
                >
                  {t(resolvedLang, "footer.leaderboard")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-main dark:text-white uppercase tracking-wider mb-4">
              {t(resolvedLang, "footer.community")}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={termsHref}
                >
                  {t(resolvedLang, "footer.rules")}
                </Link>
              </li>
              <li>
                <AuthCtaButton
                  as="a"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  authenticatedHref={addReviewHref}
                >
                  {t(resolvedLang, "footer.writeReview")}
                </AuthCtaButton>
              </li>
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={contactHref}
                >
                  {t(resolvedLang, "footer.helpCenter")}
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={contactHref}
                >
                  {t(resolvedLang, "footer.contactUs")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-main dark:text-white uppercase tracking-wider mb-4">
              {t(resolvedLang, "footer.newsletter")}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t(resolvedLang, "footer.newsletterDescription")}
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={t(resolvedLang, "footer.newsletterPlaceholder")}
                type="email"
              />
              <button className="bg-primary hover:bg-primary-dark text-white px-3 py-2 rounded text-sm font-bold transition-colors">
                {t(resolvedLang, "footer.newsletterButton")}
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 dark:border-gray-800 mt-10 pt-6 text-center text-sm text-gray-500 flex flex-col gap-2">
          <span>{t(resolvedLang, "footer.rights")}</span>
          <span className="font-medium text-primary">
            {t(resolvedLang, "footer.byline")}
          </span>
          <LanguageSwitcher
            currentLang={normalizeLanguage(lang)}
            label={t(resolvedLang, "language.label")}
            className="flex items-center justify-center gap-3 text-xs text-gray-500"
            labelClassName="uppercase tracking-wide"
            selectClassName="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </footer>
  );
}
