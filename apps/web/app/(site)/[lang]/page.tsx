import { Suspense } from "react";
import TrendingSection from "@/components/homepage/TrendingSection";
import type { Metadata } from "next";
import HomepageFeed from "@/components/homepage/HomepageFeed";
import { SidebarHomepage } from "@/components/layout/Sidebar";
import type { ReviewCardHomepageData } from "@/components/cards/ReviewCard";
import type { HomepageTopReviewer } from "@/components/layout/Sidebar";
import type { Category, Review } from "@/src/types";
import { preload } from "react-dom";
import {
  FALLBACK_AVATARS,
  FALLBACK_REVIEW_IMAGES,
  buildRatingStars,
  formatCompactNumber,
  formatRelativeTime,
  getCategoryLabel,
  pickFrom,
} from "@/src/lib/review-utils";
import { getCatalogPage, getHomepageData } from "@/src/lib/api";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";
import { buildMetadata } from "@/src/lib/seo";
import { allowMockFallback } from "@/src/lib/runtime";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { homepageReviewCards } from "@/data/mock/reviews";
import { homepageTopReviewers } from "@/data/mock/users";
import { homepagePopularCategories } from "@/data/mock/categories";
import { t } from "@/src/lib/copy";

export const runtime = 'edge';
export const revalidate = 60;

const HOMEPAGE_LIMIT = 9;
const POPULAR_LIMIT = 9;
const TRENDING_LIMIT = 3;

const TRENDING_TABS = [
  { key: "popular6h", labelKey: "homepage.trendingTabs.popular6h" },
  { key: "popular24h", labelKey: "homepage.trendingTabs.popular24h" },
  { key: "popular1w", labelKey: "homepage.trendingTabs.popular1w" },
  { key: "popular", labelKey: "homepage.trendingTabs.popular" },
  { key: "latest", labelKey: "homepage.trendingTabs.latest" },
  { key: "rating", labelKey: "homepage.trendingTabs.rating" },
] as const;
const DEFAULT_TRENDING_TAB: TrendingTab = "popular6h";

type TrendingTab = (typeof TRENDING_TABS)[number]["key"];
type FeedTab = "all" | "popular" | "photos";

function parseTrendingTab(value?: string): TrendingTab {
  const normalized = value?.toLowerCase();
  if (
    normalized &&
    TRENDING_TABS.some((t) => t.key === normalized)
  ) {
    return normalized as TrendingTab;
  }
  return DEFAULT_TRENDING_TAB;
}

function parseFeedTab(value?: string): FeedTab {
  const normalized = value?.toLowerCase();
  if (normalized === "popular" || normalized === "photos") {
    return normalized as FeedTab;
  }
  return "all";
}

function parsePageParam(value?: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

function buildHomepageHref({
  lang,
  trending,
  filter,
  page,
  includeTrendingParam,
}: {
  lang: string;
  trending?: TrendingTab;
  filter?: FeedTab;
  page?: number;
  includeTrendingParam?: boolean;
}): string {
  const params = new URLSearchParams();
  if (filter && filter !== "all") {
    params.set("filter", filter);
  }
  if (trending && (includeTrendingParam || trending !== DEFAULT_TRENDING_TAB)) {
    params.set("trending", trending);
  }
  if (page && page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  const base = localizePath("/", lang);
  return query ? `${base}?${query}` : base;
}

type HomePageProps = {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{
    filter?: string;
    trending?: string;
  }>;
};

export async function generateMetadata(
  props: HomePageProps
): Promise<Metadata> {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  return buildMetadata({
    title: t(lang, "homepage.meta.title"),
    description: t(lang, "homepage.meta.description"),
    path: "/",
    lang,
    type: "website",
  });
}

function buildHomepageCards(
  reviews: Review[],
  categories: Category[],
  lang: string
): ReviewCardHomepageData[] {
  const resolvedLang = normalizeLanguage(lang);
  return reviews.map((review, index) => {
    const categoryName = getCategoryLabel(categories, review.categoryId);
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
  });
}

function hasReviewPhoto(review: Review): boolean {
  return Array.isArray(review.photoUrls) && review.photoUrls.length > 0;
}

function filterReviewsWithPhotos(reviews: Review[]): Review[] {
  return reviews.filter(hasReviewPhoto);
}

function getReviewPhotoCount(review: Review): number {
  const urlCount = Array.isArray(review.photoUrls) ? review.photoUrls.length : 0;
  const count = typeof review.photoCount === "number" ? review.photoCount : urlCount;
  return Math.max(count, urlCount);
}

function hasPhotos(review: Review): boolean {
  return getReviewPhotoCount(review) >= 2;
}

function getHomepageBadge(review: Review): "verified" | null {
  const rating = review.ratingAvg ?? 0;
  const ratingsCount = review.ratingCount ?? 0;
  if (rating >= 4.5 && ratingsCount >= 10) {
    return "verified";
  }
  return null;
}

function buildTopReviewers(
  reviews: Review[],
  fallback: HomepageTopReviewer[],
  lang: string
): HomepageTopReviewer[] {
  const reviewers: HomepageTopReviewer[] = [];
  const seen = new Set<string>();
  const resolvedLang = normalizeLanguage(lang);

  for (const review of reviews) {
    const username = review.author.username;
    if (!username || seen.has(username)) {
      continue;
    }
    seen.add(username);
    reviewers.push({
      profile: {
        username,
        displayName: review.author.displayName ?? username,
      },
      avatarUrl:
        review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, reviewers.length),
      avatarAlt: t(resolvedLang, "homepage.avatarAlt", { username }),
      rankLabel: `#${reviewers.length + 1}`,
      reviewCountLabel: t(resolvedLang, "homepage.topReviewers.reviewCountLabel", {
        count: formatCompactNumber(review.ratingCount ?? 0, resolvedLang),
      }),
    });
    if (reviewers.length >= 3) {
      break;
    }
  }

  return reviewers.length > 0 ? reviewers : fallback;
}

export default async function Page(props: HomePageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const trendingTab = parseTrendingTab(
    typeof searchParams?.trending === "string" ? searchParams.trending : undefined
  );
  const feedTab = parseFeedTab(
    typeof searchParams?.filter === "string" ? searchParams.filter : undefined
  );
  const activeFilter = feedTab !== "all" ? feedTab : undefined;
  const feedPage = parsePageParam(
    typeof searchParams?.page === "string" ? searchParams.page : undefined
  );
  const includeTrendingParam = typeof searchParams?.trending === "string";
  const apiConfigured = true;
  let recentCards = allowMockFallback ? homepageReviewCards : [];
  let popularFeedCards = allowMockFallback ? homepageReviewCards : [];
  let feedCards = allowMockFallback ? homepageReviewCards : [];
  let hasCards = feedCards.length > 0;
  let hasMore = false;
  let topReviewers = allowMockFallback ? homepageTopReviewers : [];
  let popularCategories = allowMockFallback ? homepagePopularCategories : [];
  let categories: Category[] = allowMockFallback ? homepagePopularCategories : [];
  let trendingCards: ReviewCardHomepageData[] = [];
  let errorMessage: string | null = null;

  if (apiConfigured) {
    try {
      // Add timeout protection for API calls
      const homepage = await Promise.race([
        getHomepageData({
          latestLimit: HOMEPAGE_LIMIT,
          popularLimit: POPULAR_LIMIT,
          timeWindow:
            trendingTab === "popular6h"
              ? "6h"
              : trendingTab === "popular24h"
                ? "24h"
                : trendingTab === "popular1w"
                  ? "week"
                  : undefined,
          lang,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Homepage API timeout')), 5000)
        )
      ]);

      const latestResult = homepage.latest;
      const popularReviews = homepage.popular.items;
      categories = homepage.categories.items;

      const feedResult = await Promise.race([
        getCatalogPage(
          feedPage,
          HOMEPAGE_LIMIT,
          feedTab === "popular" ? "popular" : "latest",
          undefined,
          lang,
          { photoOnly: true }
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Catalog API timeout')), 5000)
        )
      ]);

      const latestWithPhotos = filterReviewsWithPhotos(latestResult.items);
      const popularWithPhotos = filterReviewsWithPhotos(popularReviews);
      recentCards = buildHomepageCards(latestWithPhotos, categories, lang);
      popularFeedCards = buildHomepageCards(popularWithPhotos, categories, lang);
      const feedWithPhotos = filterReviewsWithPhotos(feedResult.items);
      hasCards = feedWithPhotos.length > 0;
      const visibleFeed =
        feedTab === "photos"
          ? feedWithPhotos.filter(hasPhotos)
          : feedWithPhotos;
      feedCards = buildHomepageCards(visibleFeed, categories, lang);
      const totalPages = feedResult.pageInfo.totalPages ?? feedPage;
      hasMore = feedPage < totalPages;
      const apiTopReviewers = homepage.topReviewers.items;

      const realTopReviewers: HomepageTopReviewer[] = apiTopReviewers.map(
        (profile, index) => ({
          profile: {
            username: profile.username,
            displayName: profile.displayName ?? profile.username,
          },
          avatarUrl: profile.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index),
          avatarAlt: t(lang, "homepage.avatarAlt", { username: profile.username }),
          rankLabel: `#${index + 1}`,
          reviewCountLabel: t(lang, "homepage.topReviewers.reviewCountLabel", {
            count: formatCompactNumber(profile.stats?.reviewCount ?? 0, lang),
          }),
        })
      );

      topReviewers =
        realTopReviewers.length > 0
          ? realTopReviewers
          : buildTopReviewers(
            popularReviews,
            allowMockFallback ? homepageTopReviewers : [],
            lang
          );
      popularCategories = categories.slice(0, 7);

      // Determine what to show in the Trending section based on the selected tab
      if (trendingTab === "latest") {
        trendingCards = recentCards.slice(0, TRENDING_LIMIT);
      } else {
        trendingCards = popularFeedCards.slice(0, TRENDING_LIMIT);
      }
    } catch (e) {
      // Log error but continue rendering with fallback/empty data
      if (e instanceof Error) {
        console.error("Homepage data fetch failed:", e.message);
      }
      // Do NOT set errorMessage - allow page to render with empty/fallback content
    }
  } else if (!allowMockFallback) {
    errorMessage = t(lang, "homepage.error.apiNotConfigured");
  }

  const filterHrefs = {
    all: buildHomepageHref({
      lang,
      trending: trendingTab,
      filter: "all",
      page: 1,
      includeTrendingParam,
    }),
    popular: buildHomepageHref({
      lang,
      trending: trendingTab,
      filter: "popular",
      page: 1,
      includeTrendingParam,
    }),
    photos: buildHomepageHref({
      lang,
      trending: trendingTab,
      filter: "photos",
      page: 1,
      includeTrendingParam,
    }),
  };
  const loadMoreHref = hasMore
    ? buildHomepageHref({
      lang,
      trending: trendingTab,
      filter: feedTab,
      page: feedPage + 1,
      includeTrendingParam,
    })
    : null;
  const heroPreloadUrls = new Set(
    trendingCards
      .slice(0, TRENDING_LIMIT)
      .map((card) => getOptimizedImageUrl(card.imageUrl, 300))
      .filter(Boolean)
  );
  heroPreloadUrls.forEach((url) => {
    preload(url, { as: "image" });
  });

  return (
    <div
      className="bg-surface-light dark:bg-background-dark font-display text-text-main antialiased min-h-screen flex flex-col"
      data-page="homepage"
    >
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-8 sm:py-8">
        {errorMessage ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {errorMessage}
          </div>
        ) : null}
        <TrendingSection
          lang={lang}
          initialTab={trendingTab}
          initialData={trendingCards}
          activeFilter={activeFilter}
        />

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 w-full lg:w-2/3">
            <Suspense fallback={<div className="animate-pulse space-y-4 shadow-sm h-64 bg-gray-100 rounded-lg" />}>
              <HomepageFeed
                cards={feedCards}
                hasCards={hasCards}
                hasMore={hasMore}
                tab={feedTab}
                lang={lang}
                filterHrefs={filterHrefs}
                loadMoreHref={loadMoreHref}
              />
            </Suspense>
          </div>
          <SidebarHomepage
            lang={lang}
            topReviewers={topReviewers}
            popularCategories={popularCategories}
          />
        </div>
      </main>
    </div>
  );
}
