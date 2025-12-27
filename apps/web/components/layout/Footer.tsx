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
  const leaderboardHref = localizePath("/leaderboard", lang);
  const termsHref = localizePath("/terms-of-use", lang);
  const privacyHref = localizePath("/privacy-policy", lang);
  const contactHref = localizePath("/contact", lang);
  const aboutHref = localizePath("/about-us", lang);
  const addReviewHref = localizePath("/node/add/review", lang);

  return (
    <footer className="bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-gray-800 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-y-12 gap-x-8 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-3 space-y-6">
            <Link className="flex items-center gap-2" href={homeHref}>
              <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-2xl">forum</span>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                UserReview
              </span>
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-sm">
              {t(resolvedLang, "footer.description")}
            </p>
            <div className="flex gap-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="size-10 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-primary hover:text-white transition-all duration-200"
                aria-label={t(resolvedLang, "footer.social.facebook")}
              >
                <span className="text-sm font-bold uppercase">FB</span>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="size-10 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-primary hover:text-white transition-all duration-200"
                aria-label={t(resolvedLang, "footer.social.twitter")}
              >
                <span className="text-sm font-bold uppercase">TW</span>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="size-10 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-primary hover:text-white transition-all duration-200"
                aria-label={t(resolvedLang, "footer.social.instagram")}
              >
                <span className="text-sm font-bold uppercase">IG</span>
              </a>
              <a
                href="/feed.xml"
                target="_blank"
                rel="noreferrer"
                className="size-10 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-[#ee802f] hover:text-white transition-all duration-200"
                aria-label="RSS Feed"
              >
                <span className="material-symbols-outlined text-xl">rss_feed</span>
              </a>
            </div>
          </div>

          {/* Explore Column */}
          <div className="lg:col-span-2 lg:col-start-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-6">
              {t(resolvedLang, "footer.explore")}
            </h3>
            <ul className="space-y-4">
              <li>
                <Link href={catalogHref} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors block">
                  {t(resolvedLang, "footer.categories")}
                </Link>
              </li>
              <li>
                <Link href={leaderboardHref} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors block">
                  {t(resolvedLang, "footer.leaderboard")}
                </Link>
              </li>
              <li>
                <Link href={topRatedHref} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors block">
                  {t(resolvedLang, "footer.topRated")}
                </Link>
              </li>
              <li>
                <Link href={recentHref} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors block">
                  {t(resolvedLang, "footer.recentReviews")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-6">
              {t(resolvedLang, "footer.community")}
            </h3>
            <ul className="space-y-4">
              <li>
                <Link href={aboutHref} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors block">
                  {t(resolvedLang, "footer.aboutUs")}
                </Link>
              </li>
              {/* Added Mock 'Careers' and 'Press' links pointing to About for professional look */}
              <li>
                <Link href={aboutHref} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors block">
                  {t(resolvedLang, "footer.careers")}
                </Link>
              </li>
              <li>
                <Link href={aboutHref} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors block">
                  {t(resolvedLang, "footer.press")}
                </Link>
              </li>
              <li>
                <Link href={contactHref} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors block">
                  {t(resolvedLang, "footer.contactUs")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Column */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-6">
              {t(resolvedLang, "footer.support")}
            </h3>
            <ul className="space-y-4">
              <li>
                <Link href={contactHref} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors block">
                  {t(resolvedLang, "footer.helpCenter")}
                </Link>
              </li>
              <li>
                <Link href={privacyHref} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors block">
                  {t(resolvedLang, "footer.safetyCenter")}
                </Link>
              </li>
              <li>
                <Link href={termsHref} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors block">
                  {t(resolvedLang, "footer.rules")}
                </Link>
              </li>
              <li>
                <Link href={privacyHref} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors block">
                  {t(resolvedLang, "footer.privacyPolicy")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Column */}
          <div className="lg:col-span-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-6">
              {t(resolvedLang, "footer.newsletter")}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
              {t(resolvedLang, "footer.newsletterDescription")}
            </p>
            <form className="flex gap-2 mb-6">
              <input
                type="email"
                placeholder={t(resolvedLang, "footer.newsletterPlaceholder")}
                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <button className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors">
                {t(resolvedLang, "footer.newsletterButton")}
              </button>
            </form>
            <AuthCtaButton
              as="a"
              className="inline-flex items-center justify-center w-full px-4 py-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-200 gap-2"
              authenticatedHref={addReviewHref}
            >
              <span className="material-symbols-outlined text-[20px]">rate_review</span>
              {t(resolvedLang, "footer.writeReview")}
            </AuthCtaButton>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center gap-4 text-sm text-gray-500">
            <span>© {new Date().getFullYear()} UserReview. {t(resolvedLang, "footer.rights")}</span>
            <span className="hidden md:inline text-gray-300">•</span>
            <span className="flex items-center gap-1">
              {t(resolvedLang, "footer.madeWithPrefix")}
              <span className="text-red-500 text-lg">♥</span>
              {t(resolvedLang, "footer.madeWithSuffix")}
            </span>
          </div>

          <LanguageSwitcher
            currentLang={normalizeLanguage(lang)}
            label={t(resolvedLang, "language.label")}
            className="flex items-center gap-3 text-sm text-gray-500"
            labelClassName="hidden sm:inline font-medium"
            selectClassName="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
    </footer>
  );
}
