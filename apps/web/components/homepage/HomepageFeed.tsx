import Link from "next/link";
import type { ReviewCardHomepageData } from "@/components/cards/ReviewCard";
import ReviewCardHomepageServer from "@/components/cards/ReviewCardHomepageServer";
import { t } from "@/src/lib/copy";
import { normalizeLanguage, type SupportedLanguage } from "@/src/lib/i18n";

type FeedTab = "all" | "popular" | "photos";

type HomepageFeedProps = {
  cards: ReviewCardHomepageData[];
  hasCards: boolean;
  hasMore: boolean;
  tab: FeedTab;
  lang: SupportedLanguage;
  filterHrefs: {
    all: string;
    popular: string;
    photos: string;
  };
  loadMoreHref?: string | null;
};

const ACTIVE_FILTER_CLASS =
  "px-3 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-bold bg-primary text-white rounded-full whitespace-nowrap shrink-0 transition-colors";
const INACTIVE_FILTER_CLASS =
  "px-3 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-bold bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 whitespace-nowrap shrink-0 transition-colors";

export default function HomepageFeed({
  cards,
  hasCards,
  hasMore,
  tab,
  lang,
  filterHrefs,
  loadMoreHref,
}: HomepageFeedProps) {
  const resolvedLang = normalizeLanguage(lang);
  const hasVisibleCards = cards.length > 0;
  const loadMoreLabel = hasMore
    ? t(resolvedLang, "homepage.loadMore")
    : t(resolvedLang, "homepage.empty.caughtUp");
  const loadMoreClasses =
    "w-full py-3 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-primary font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const tabs = [
    { key: "all", label: t(resolvedLang, "homepage.filters.all"), href: filterHrefs.all },
    {
      key: "popular",
      label: t(resolvedLang, "homepage.filters.popular"),
      href: filterHrefs.popular,
    },
    {
      key: "photos",
      label: t(resolvedLang, "homepage.filters.photos"),
      href: filterHrefs.photos,
    },
  ] as const;

  const loadMoreControl = hasMore && loadMoreHref ? (
    <Link className={loadMoreClasses} href={loadMoreHref} prefetch={false}>
      {loadMoreLabel}
    </Link>
  ) : (
    <span className={`${loadMoreClasses} cursor-not-allowed opacity-60`}>
      {loadMoreLabel}
    </span>
  );

  return (
    <>
      <div className="flex items-center gap-2 sm:justify-between sm:gap-x-4 mb-4 sm:mb-6 overflow-hidden">
        <h2 className="text-sm sm:text-2xl font-bold text-text-main dark:text-white whitespace-nowrap shrink-0">
          {t(resolvedLang, "homepage.recentReviews")}
        </h2>
        <div className="flex flex-1 sm:flex-none gap-1.5 p-1 overflow-x-auto no-scrollbar sm:flex-wrap bg-gray-50/80 dark:bg-gray-800/50 rounded-full border border-gray-100 dark:border-gray-800 backdrop-blur-sm">
          {tabs.map((item) => {
            const isActive = item.key === tab;
            return (
              <Link
                key={item.key}
                className={isActive ? ACTIVE_FILTER_CLASS : INACTIVE_FILTER_CLASS}
                href={item.href}
                prefetch={false}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
      {!hasCards ? (
        <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-6 text-center text-sm text-text-muted">
          {t(resolvedLang, "homepage.empty.noReviews")}
        </div>
      ) : !hasVisibleCards ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-6 text-center">
            <p className="text-sm text-text-muted">
              {t(resolvedLang, "homepage.empty.noFilterResults")}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-text-main hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                href={filterHrefs.all}
                prefetch={false}
              >
                {t(resolvedLang, "homepage.empty.clearFilters")}
              </Link>
              {loadMoreControl}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 -mx-4 sm:mx-0">
          {cards.map((card, index) => (
            <div
              key={card.review.id || card.review.slug || `homepage-${index}`}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(index * 75, 600)}ms` }}
            >
              <ReviewCardHomepageServer
                {...card}
                lang={resolvedLang}
                imagePriority={index === 0}
              />
            </div>
          ))}
          <div className="space-y-2">
            {loadMoreControl}
            {!hasMore ? (
              <p className="text-center text-xs text-text-muted">
                {t(resolvedLang, "homepage.empty.checkBackSoon")}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
