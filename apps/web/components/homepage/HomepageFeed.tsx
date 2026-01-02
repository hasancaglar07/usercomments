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
import { getCatalogPage, getLatestReviews } from "@/src/lib/api";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

type FeedTab = "all" | "popular" | "photos";

type HomepageFeedProps = {
  initialCards: ReviewCardHomepageData[];
  initialNextCursor: string | null;
  categories: Category[];
  pageSize: number;
  initialPopularCards?: ReviewCardHomepageData[];
};

type PrefetchState = {
  cursor: string;
  items: Review[];
  nextCursor: string | null;
};

const ACTIVE_FILTER_CLASS =
  "px-3 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-bold bg-primary text-white rounded-full whitespace-nowrap shrink-0 transition-colors";
const INACTIVE_FILTER_CLASS =
  "px-3 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-bold bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 whitespace-nowrap shrink-0 transition-colors";

const FEED_TABS: FeedTab[] = ["all", "popular", "photos"];
const LOAD_MORE_SKELETON_COUNT = 3;

function parseTab(value?: string | null): FeedTab {
  if (!value) {
    return "all";
  }
  const normalized = value.toLowerCase();
  return FEED_TABS.includes(normalized as FeedTab)
    ? (normalized as FeedTab)
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

function hasReviewPhoto(review: Review): boolean {
  return Array.isArray(review.photoUrls) && review.photoUrls.length > 0;
}

function getReviewPhotoCount(review: Review): number {
  const urlCount = Array.isArray(review.photoUrls) ? review.photoUrls.length : 0;
  const count = typeof review.photoCount === "number" ? review.photoCount : urlCount;
  return Math.max(count, urlCount);
}

function hasPhotos(review: Review): boolean {
  return getReviewPhotoCount(review) >= 2;
}

function sortHomepageCardsByLatest(cards: ReviewCardHomepageData[]) {
  return [...cards].sort((left, right) => {
    const leftTime = Date.parse(left.review.createdAt);
    const rightTime = Date.parse(right.review.createdAt);
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
      const leftKey = left.review.id ?? left.review.slug;
      const rightKey = right.review.id ?? right.review.slug;
      return rightKey.localeCompare(leftKey);
    }
    if (Number.isNaN(leftTime)) {
      return 1;
    }
    if (Number.isNaN(rightTime)) {
      return -1;
    }
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    const leftKey = left.review.id ?? left.review.slug;
    const rightKey = right.review.id ?? right.review.slug;
    return rightKey.localeCompare(leftKey);
  });
}

import { Skeleton } from "@/components/ui/Skeleton";

function HomepageFeedSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={`homepage-skeleton-${index}`}
          className="flex flex-col sm:flex-row bg-background-light dark:bg-surface-dark rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden"
        >
          <Skeleton className="w-full sm:w-48 h-48 sm:h-auto flex-shrink-0 rounded-none" />
          <div className="flex-1 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-2 w-24" />
                  </div>
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-full" />
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
              <Skeleton className="h-3 w-20" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          </div>
        </article>
      ))}
    </>
  );
}

export default function HomepageFeed({
  initialCards,
  initialNextCursor,
  categories,
  pageSize,
  initialPopularCards,
}: HomepageFeedProps) {
  const filteredInitialCards = initialCards.filter((card) =>
    hasReviewPhoto(card.review)
  );
  const filteredInitialPopularCards = (initialPopularCards ?? []).filter((card) =>
    hasReviewPhoto(card.review)
  );
  const [latestCards, setLatestCards] = useState<ReviewCardHomepageData[]>(
    filteredInitialCards
  );
  const [latestNextCursor, setLatestNextCursor] =
    useState<string | null>(initialNextCursor);
  const [popularCards, setPopularCards] = useState<ReviewCardHomepageData[]>(
    filteredInitialPopularCards
  );
  const [popularPage, setPopularPage] = useState(
    initialPopularCards && initialPopularCards.length > 0 ? 1 : 0
  );
  const [popularHasMore, setPopularHasMore] = useState(() => {
    if (initialPopularCards && initialPopularCards.length > 0) {
      return initialPopularCards.length >= pageSize;
    }
    return true;
  });
  const [prefetchState, setPrefetchState] = useState<PrefetchState | null>(null);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const params = useParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<FeedTab>(parseTab(searchParams?.get("filter")));
  const seenIds = useRef(
    new Set(filteredInitialCards.map((card) => card.review.id))
  );
  const popularSeenIdsRef = useRef(
    new Set(filteredInitialPopularCards.map((card) => card.review.id))
  );
  const pendingIdsRef = useRef(new Set<string>());
  const autoLoadKeyRef = useRef<string | null>(null);
  const prefetchTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const tabs = [
    { key: "all", label: t(lang, "homepage.filters.all") },
    { key: "popular", label: t(lang, "homepage.filters.popular") },
    { key: "photos", label: t(lang, "homepage.filters.photos") },
  ] as const;

  const updateTab = useCallback(
    (nextTab: FeedTab) => {
      setTab(nextTab);
      setLoadError(false);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (nextTab === "all") {
        params.delete("filter");
      } else {
        params.set("filter", nextTab);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname ?? "", {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const nextTab = parseTab(searchParams?.get("filter"));
    setTab((prev) => (prev === nextTab ? prev : nextTab));
    setLoadError(false);
  }, [searchParams]);

  const sortedLatestCards = useMemo(
    () => sortHomepageCardsByLatest(latestCards),
    [latestCards]
  );

  const visibleCards = useMemo(() => {
    if (tab === "popular") {
      return popularCards;
    }
    if (tab === "photos") {
      return sortedLatestCards.filter((card) => hasPhotos(card.review));
    }
    return sortedLatestCards;
  }, [popularCards, sortedLatestCards, tab]);

  useEffect(() => {
    if (latestCards.length === 0 && !latestNextCursor) {
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
          if (!hasReviewPhoto(review)) {
            return false;
          }
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
  }, [latestCards.length, latestNextCursor, lang, pageSize]);

  useEffect(() => {
    if (tab === "popular") {
      setPrefetchState(null);
      return;
    }
    if (!latestNextCursor) {
      setPrefetchState(null);
      return;
    }

    let cancelled = false;
    if (prefetchTimerRef.current) {
      window.clearTimeout(prefetchTimerRef.current);
    }

    prefetchTimerRef.current = window.setTimeout(async () => {
      try {
        const result = await getLatestReviews(pageSize, latestNextCursor, lang);
        if (cancelled) {
          return;
        }
        setPrefetchState({
          cursor: latestNextCursor,
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
  }, [lang, latestNextCursor, pageSize, tab]);

  const loadPopularPage = useCallback(
    async (page: number) => {
      const result = await getCatalogPage(page, pageSize, "popular", undefined, lang);
      const photoItems = result.items.filter(hasReviewPhoto);
      setLoadError(false);
      if (page === 1) {
        popularSeenIdsRef.current.clear();
      }
      setPopularCards((prev) => {
        const startIndex = page === 1 ? 0 : prev.length;
        const nextCards = photoItems
          .map((review, index) =>
            buildHomepageCard(review, categories, startIndex + index, lang)
          )
          .filter((card) => {
            const id = card.review.id;
            if (!id || popularSeenIdsRef.current.has(id)) {
              return false;
            }
            popularSeenIdsRef.current.add(id);
            return true;
          });
        if (page === 1) {
          return nextCards;
        }
        if (nextCards.length > 0) {
          return [...prev, ...nextCards];
        }
        return prev;
      });
      setPopularPage(page);
      const totalPages = result.pageInfo.totalPages ?? page;
      setPopularHasMore(page < totalPages && result.items.length > 0);
    },
    [categories, lang, pageSize]
  );

  useEffect(() => {
    if (tab !== "popular") {
      return;
    }
    if (popularPage === 0 || popularCards.length === 0) {
      setIsLoading(true);
      loadPopularPage(1)
        .catch((error) => {
          console.error("Failed to load popular reviews", error);
          setLoadError(true);
        })
        .finally(() => setIsLoading(false));
    }
  }, [loadPopularPage, popularCards.length, popularPage, tab]);

  const handleLoadMore = useCallback(async () => {
    if (isLoading) {
      return;
    }
    setLoadError(false);
    if (tab === "popular") {
      if (!popularHasMore) {
        return;
      }
      setIsLoading(true);
      try {
        await loadPopularPage(popularPage + 1);
      } catch (error) {
        console.error("Failed to load more popular reviews", error);
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    if (!latestNextCursor) {
      return;
    }
    setIsLoading(true);
    try {
      const prefetched =
        prefetchState && prefetchState.cursor === latestNextCursor
          ? prefetchState
          : null;
      const result =
        prefetched ?? (await getLatestReviews(pageSize, latestNextCursor, lang));
      setPrefetchState(null);
      setLoadError(false);
      const photoItems = result.items.filter(hasReviewPhoto);
      setLatestCards((prev) => {
        const startIndex = prev.length;
        const nextCards = photoItems
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
      const isExhausted =
        result.nextCursor === null ||
        result.nextCursor === latestNextCursor ||
        result.items.length < pageSize;
      setLatestNextCursor(isExhausted ? null : result.nextCursor);
    } catch (error) {
      console.error("Failed to load more reviews", error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [
    categories,
    isLoading,
    lang,
    latestNextCursor,
    loadPopularPage,
    pageSize,
    popularHasMore,
    popularPage,
    prefetchState,
    tab,
  ]);

  const handleApplyNewReviews = useCallback(() => {
    if (pendingReviews.length === 0) {
      return;
    }
    const nextCards = pendingReviews.map((review, index) =>
      buildHomepageCard(review, categories, index, lang)
    );
    nextCards.forEach((card) => {
      if (card.review.id) {
        seenIds.current.add(card.review.id);
      }
    });
    setLatestCards((prev) => [...nextCards, ...prev]);
    pendingIdsRef.current.clear();
    setPendingReviews([]);
  }, [categories, lang, pendingReviews]);

  useEffect(() => {
    if (pendingReviews.length === 0 || tab === "popular") {
      return;
    }
    if (typeof window !== "undefined" && window.scrollY < 160) {
      handleApplyNewReviews();
    }
  }, [handleApplyNewReviews, pendingReviews.length, tab]);

  useEffect(() => {
    autoLoadKeyRef.current = null;
  }, [tab]);

  const hasCards = (tab === "popular" ? popularCards : latestCards).length > 0;
  const hasVisibleCards = visibleCards.length > 0;
  const hasMore =
    tab === "popular"
      ? popularHasMore
      : Boolean(latestNextCursor);
  const skeletonCount = Math.min(pageSize, LOAD_MORE_SKELETON_COUNT);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || isLoading || loadError) {
          return;
        }
        const loadKey =
          tab === "popular"
            ? `popular-${popularPage}`
            : latestNextCursor ?? null;
        if (!loadKey || autoLoadKeyRef.current === loadKey) {
          return;
        }
        autoLoadKeyRef.current = loadKey;
        handleLoadMore();
      },
      { rootMargin: "320px" }
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [
    handleLoadMore,
    hasMore,
    isLoading,
    latestNextCursor,
    loadError,
    popularPage,
    tab,
  ]);

  const loadMoreLabel = isLoading
    ? t(lang, "homepage.loading")
    : loadError
      ? t(lang, "common.retry")
      : hasMore
        ? t(lang, "homepage.loadMore")
        : t(lang, "homepage.empty.caughtUp");

  return (
    <>
      <div className="flex items-center gap-2 sm:justify-between sm:gap-x-4 mb-4 sm:mb-6 overflow-hidden">
        <h2 className="text-sm sm:text-2xl font-bold text-text-main dark:text-white whitespace-nowrap shrink-0">
          {t(lang, "homepage.recentReviews")}
        </h2>
        <div className="flex flex-1 sm:flex-none gap-1.5 p-1 overflow-x-auto no-scrollbar sm:flex-wrap bg-gray-50/80 dark:bg-gray-800/50 rounded-full border border-gray-100 dark:border-gray-800 backdrop-blur-sm">
          {tabs.map((item) => {
            const isActive = item.key === tab;
            return (
              <button
                key={item.key}
                className={isActive ? ACTIVE_FILTER_CLASS : INACTIVE_FILTER_CLASS}
                type="button"
                onClick={() => updateTab(item.key)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      {pendingReviews.length > 0 && tab !== "popular" ? (
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
        isLoading ? (
          <div className="space-y-6">
            <HomepageFeedSkeleton count={skeletonCount} />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-6 text-center text-sm text-text-muted">
            {t(
              lang,
              loadError ? "homepage.error.loadFailed" : "homepage.empty.noReviews"
            )}
          </div>
        )
      ) : !hasVisibleCards ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-6 text-center">
            <p className="text-sm text-text-muted">
              {t(lang, "homepage.empty.noFilterResults")}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-text-main hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                type="button"
                onClick={() => updateTab("all")}
              >
                {t(lang, "homepage.empty.clearFilters")}
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                type="button"
                onClick={handleLoadMore}
                disabled={isLoading || (!hasMore && !loadError)}
              >
                {loadMoreLabel}
              </button>
            </div>
          </div>
          {isLoading ? <HomepageFeedSkeleton count={skeletonCount} /> : null}
        </div>
      ) : (
        <div className="space-y-6 -mx-4 sm:mx-0">
          {visibleCards.map((card, index) => (
            <div
              key={card.review.id || card.review.slug || `homepage-${index}`}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(index * 75, 600)}ms` }}
            >
              <ReviewCardHomepage
                {...card}
                lang={lang}
                imagePriority={index === 0}
              />
            </div>
          ))}
          {isLoading ? <HomepageFeedSkeleton count={skeletonCount} /> : null}
          <div className="space-y-2">
            <button
              className="w-full py-3 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-primary font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleLoadMore}
              disabled={isLoading || (!hasMore && !loadError)}
            >
              {loadMoreLabel}
            </button>
            {!isLoading && (loadError || !hasMore) ? (
              <p className="text-center text-xs text-text-muted">
                {loadError
                  ? t(lang, "homepage.error.loadFailed")
                  : t(lang, "homepage.empty.checkBackSoon")}
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
