"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  ReviewCardHomepage,
  type ReviewCardHomepageData,
} from "@/components/cards/ReviewCard";
import type { Category, Review } from "@/src/types";
import {
  FALLBACK_AVATARS,
  FALLBACK_REVIEW_IMAGES,
  buildRatingStars,
  formatCompactNumber,
  formatRelativeTime,
  getCategoryLabel,
  pickFrom,
} from "@/src/lib/review-utils";
import { getLatestReviews } from "@/src/lib/api";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

type FilterKey = "all" | "photos" | "verified";

type HomepageFeedProps = {
  initialCards: ReviewCardHomepageData[];
  initialNextCursor: string | null;
  categories: Category[];
  pageSize: number;
};

type PrefetchState = {
  cursor: string;
  items: Review[];
  nextCursor: string | null;
};

const ACTIVE_FILTER_CLASS =
  "px-3 py-1 text-xs font-medium bg-primary text-white rounded-full";
const INACTIVE_FILTER_CLASS =
  "px-3 py-1 text-xs font-medium bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50";
const FILTER_KEYS: FilterKey[] = ["all", "photos", "verified"];

function parseFilter(value?: string | null): FilterKey {
  if (!value) {
    return "all";
  }
  const normalized = value.toLowerCase();
  return FILTER_KEYS.includes(normalized as FilterKey)
    ? (normalized as FilterKey)
    : "all";
}

function getHomepageBadge(review: Review): "verified" | null {
  const rating = review.ratingAvg ?? 0;
  const ratingsCount = review.ratingCount ?? 0;
  if (rating >= 4.5 && ratingsCount >= 10) {
    return "verified";
  }
  return null;
}

function buildHomepageCard(
  review: Review,
  categories: Category[],
  index: number,
  lang: string
): ReviewCardHomepageData {
  const categoryName = getCategoryLabel(categories, review.categoryId);
  const resolvedLang = normalizeLanguage(lang);
  const relative = formatRelativeTime(review.createdAt, resolvedLang);

  return {
    review,
    href: localizePath(`/content/${review.slug}`, lang),
    authorMeta: categoryName
      ? t(resolvedLang, "homepage.reviewerMetaWithCategory", {
          category: categoryName,
        })
      : t(resolvedLang, "homepage.reviewerMetaCommunity"),
    postedLabel: relative
      ? t(resolvedLang, "homepage.postedWithRelative", { relative })
      : t(resolvedLang, "homepage.postedRecently"),
    ratingStars: buildRatingStars(review.ratingAvg),
    ratingValue: (review.ratingAvg ?? 0).toFixed(1),
    imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
    imageAlt: review.title,
    avatarUrl: review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index),
    avatarAlt: t(resolvedLang, "homepage.avatarAlt", {
      username: review.author.username,
    }),
    badge: getHomepageBadge(review),
    likesLabel: formatCompactNumber(review.votesUp ?? 0, resolvedLang),
    commentsLabel: formatCompactNumber(review.commentCount ?? 0, resolvedLang),
    photoCountLabel:
      review.photoCount && review.photoCount > 0
        ? formatCompactNumber(review.photoCount, resolvedLang)
        : undefined,
  };
}

function hasPhotos(review: Review): boolean {
  return Boolean(
    (review.photoCount ?? 0) > 0 || (review.photoUrls?.length ?? 0) > 0
  );
}

export default function HomepageFeed({
  initialCards,
  initialNextCursor,
  categories,
  pageSize,
}: HomepageFeedProps) {
  const [cards, setCards] = useState<ReviewCardHomepageData[]>(initialCards);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [prefetchState, setPrefetchState] = useState<PrefetchState | null>(null);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const params = useParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<FilterKey>(
    parseFilter(searchParams.get("filter"))
  );
  const seenIds = useRef(new Set(initialCards.map((card) => card.review.id)));
  const pendingIdsRef = useRef(new Set<string>());
  const autoLoadCursorRef = useRef<string | null>(null);
  const prefetchTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const filters = [
    { key: "all", label: t(lang, "homepage.filters.all") },
    { key: "photos", label: t(lang, "homepage.filters.photos") },
    { key: "verified", label: t(lang, "homepage.filters.verified") },
  ] as const;

  const updateFilter = useCallback(
    (nextFilter: FilterKey) => {
      setFilter(nextFilter);
      const params = new URLSearchParams(searchParams.toString());
      if (nextFilter === "all") {
        params.delete("filter");
      } else {
        params.set("filter", nextFilter);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const nextFilter = parseFilter(searchParams.get("filter"));
    setFilter((prev) => (prev === nextFilter ? prev : nextFilter));
  }, [searchParams]);

  const visibleCards = useMemo(() => {
    if (filter === "photos") {
      return cards.filter((card) => hasPhotos(card.review));
    }
    if (filter === "verified") {
      return cards.filter((card) => card.badge === "verified");
    }
    return cards;
  }, [cards, filter]);

  useEffect(() => {
    if (cards.length === 0) {
      setPendingReviews([]);
      pendingIdsRef.current.clear();
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const result = await getLatestReviews(pageSize, null, lang);
        if (cancelled) {
          return;
        }
        const fresh = result.items.filter((review) => {
          const id = review.id;
          if (!id) {
            return false;
          }
          return !seenIds.current.has(id) && !pendingIdsRef.current.has(id);
        });
        if (fresh.length > 0) {
          fresh.forEach((review) => {
            if (review.id) {
              pendingIdsRef.current.add(review.id);
            }
          });
          setPendingReviews((prev) => {
            const merged = [...fresh, ...prev];
            const unique: Review[] = [];
            const seen = new Set<string>();
            for (const review of merged) {
              if (!review.id || seen.has(review.id)) {
                continue;
              }
              seen.add(review.id);
              unique.push(review);
            }
            return unique;
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to check for new reviews", error);
        }
      }
    };

    const schedule = () => {
      pollTimerRef.current = window.setTimeout(async () => {
        await poll();
        if (!cancelled) {
          schedule();
        }
      }, 60000);
    };
    schedule();

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, [cards.length, lang, pageSize]);

  useEffect(() => {
    if (!nextCursor) {
      setPrefetchState(null);
      return;
    }

    let cancelled = false;
    if (prefetchTimerRef.current) {
      window.clearTimeout(prefetchTimerRef.current);
    }

    prefetchTimerRef.current = window.setTimeout(async () => {
      try {
        const result = await getLatestReviews(pageSize, nextCursor, lang);
        if (cancelled) {
          return;
        }
        setPrefetchState({
          cursor: nextCursor,
          items: result.items,
          nextCursor: result.nextCursor,
        });
      } catch (error) {
        if (!cancelled) {
          setPrefetchState(null);
        }
        console.error("Failed to prefetch reviews", error);
      }
    }, 600);

    return () => {
      cancelled = true;
      if (prefetchTimerRef.current) {
        window.clearTimeout(prefetchTimerRef.current);
      }
    };
  }, [lang, nextCursor, pageSize]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      const prefetched =
        prefetchState && prefetchState.cursor === nextCursor
          ? prefetchState
          : null;
      const result = prefetched ?? (await getLatestReviews(pageSize, nextCursor, lang));
      setPrefetchState(null);
      setCards((prev) => {
        const startIndex = prev.length;
        const nextCards = result.items
          .map((review, index) =>
            buildHomepageCard(review, categories, startIndex + index, lang)
          )
          .filter((card) => {
            const id = card.review.id;
            if (!id || seenIds.current.has(id)) {
              return false;
            }
            seenIds.current.add(id);
            return true;
          });
        if (nextCards.length > 0) {
          return [...prev, ...nextCards];
        }
        return prev;
      });
      setNextCursor(result.nextCursor);
    } catch (error) {
      console.error("Failed to load more reviews", error);
    } finally {
      setIsLoading(false);
    }
  }, [categories, isLoading, lang, nextCursor, pageSize, prefetchState]);

  const handleApplyNewReviews = useCallback(() => {
    if (pendingReviews.length === 0) {
      return;
    }
    updateFilter("all");
    const nextCards = pendingReviews.map((review, index) =>
      buildHomepageCard(review, categories, index, lang)
    );
    nextCards.forEach((card) => {
      if (card.review.id) {
        seenIds.current.add(card.review.id);
      }
    });
    setCards((prev) => [...nextCards, ...prev]);
    pendingIdsRef.current.clear();
    setPendingReviews([]);
  }, [categories, lang, pendingReviews, updateFilter]);

  useEffect(() => {
    if (!sentinelRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !nextCursor || isLoading) {
          return;
        }
        if (autoLoadCursorRef.current === nextCursor) {
          return;
        }
        autoLoadCursorRef.current = nextCursor;
        handleLoadMore();
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [handleLoadMore, isLoading, nextCursor]);

  const hasCards = cards.length > 0;
  const hasVisibleCards = visibleCards.length > 0;
  const hasMore = Boolean(nextCursor);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-text-main dark:text-white">
          {t(lang, "homepage.recentReviews")}
        </h2>
        <div className="flex gap-2">
          {filters.map((item) => {
            const isActive = item.key === filter;
            return (
              <button
                key={item.key}
                className={isActive ? ACTIVE_FILTER_CLASS : INACTIVE_FILTER_CLASS}
                type="button"
                onClick={() => updateFilter(item.key)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      {pendingReviews.length > 0 ? (
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <span className="font-medium">
            {t(lang, "homepage.newReviews", { count: pendingReviews.length })}
          </span>
          <button
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
            type="button"
            onClick={handleApplyNewReviews}
          >
            {t(lang, "homepage.newReviewsAction")}
          </button>
        </div>
      ) : null}
      {!hasCards ? (
        <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-6 text-center text-sm text-text-muted">
          {t(lang, "homepage.empty.noReviews")}
        </div>
      ) : !hasVisibleCards ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-6 text-center">
          <p className="text-sm text-text-muted">
            {t(lang, "homepage.empty.noFilterResults")}
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-text-main hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              type="button"
              onClick={() => updateFilter("all")}
            >
              {t(lang, "homepage.empty.clearFilters")}
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              type="button"
              onClick={handleLoadMore}
              disabled={!hasMore || isLoading}
            >
              {isLoading
                ? t(lang, "homepage.loading")
                : hasMore
                  ? t(lang, "homepage.loadMore")
                  : t(lang, "homepage.empty.caughtUp")}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleCards.map((card, index) => (
            <ReviewCardHomepage
              key={card.review.id || card.review.slug || `homepage-${index}`}
              {...card}
              lang={lang}
              imagePriority={index === 0}
            />
          ))}
          <div className="space-y-2">
            <button
              className="w-full py-3 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-primary font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleLoadMore}
              disabled={!hasMore || isLoading}
            >
              {isLoading
                ? t(lang, "homepage.loading")
                : hasMore
                  ? t(lang, "homepage.loadMore")
                  : t(lang, "homepage.empty.caughtUp")}
            </button>
            {!hasMore && !isLoading ? (
              <p className="text-center text-xs text-text-muted">
                {t(lang, "homepage.empty.checkBackSoon")}
              </p>
            ) : null}
            {hasMore ? (
              <div ref={sentinelRef} aria-hidden="true" className="h-px" />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
