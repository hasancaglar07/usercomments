import Link from "next/link";
import AuthCtaButton from "@/components/auth/AuthCtaButton";
import { localizePath } from "@/src/lib/i18n";

type FooterProps = {
  lang: string;
};

export default function Footer({ lang }: FooterProps) {
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
                UserComments.net
              </h2>
            </Link>
            <p className="text-sm text-text-muted mb-4 italic">
              &quot;The Voice of Real Users&quot;
            </p>
            <p className="text-sm text-text-muted mb-4">
              The most trusted review platform. We help you make the best
              decisions with real user experiences.
            </p>
            <div className="flex gap-4">
              <a
                className="text-gray-400 hover:text-primary transition-colors"
                href="https://facebook.com"
                rel="noreferrer"
                target="_blank"
              >
                <span className="sr-only">Facebook</span>FB
              </a>
              <a
                className="text-gray-400 hover:text-primary transition-colors"
                href="https://twitter.com"
                rel="noreferrer"
                target="_blank"
              >
                <span className="sr-only">Twitter</span>TW
              </a>
              <a
                className="text-gray-400 hover:text-primary transition-colors"
                href="https://instagram.com"
                rel="noreferrer"
                target="_blank"
              >
                <span className="sr-only">Instagram</span>IG
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-main dark:text-white uppercase tracking-wider mb-4">
              Explore
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={catalogHref}
                >
                  Categories
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={topRatedHref}
                >
                  Top Rated
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={recentHref}
                >
                  Recent Reviews
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={leaderboardHref}
                >
                  Leaderboard
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-main dark:text-white uppercase tracking-wider mb-4">
              Community
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={termsHref}
                >
                  Rules &amp; Guidelines
                </Link>
              </li>
              <li>
                <AuthCtaButton
                  as="a"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  authenticatedHref={addReviewHref}
                >
                  Write a Review
                </AuthCtaButton>
              </li>
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={contactHref}
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary"
                  href={contactHref}
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-main dark:text-white uppercase tracking-wider mb-4">
              Newsletter
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Subscribe to get the best reviews directly to your inbox.
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Your email"
                type="email"
              />
              <button className="bg-primary hover:bg-primary-dark text-white px-3 py-2 rounded text-sm font-bold transition-colors">
                Go
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 dark:border-gray-800 mt-10 pt-6 text-center text-sm text-gray-500 flex flex-col gap-2">
          <span>© 2024 UserComments.net. All rights reserved.</span>
          <span className="font-medium text-primary">By users, for users.</span>
        </div>
      </div>
    </footer>
  );
}
