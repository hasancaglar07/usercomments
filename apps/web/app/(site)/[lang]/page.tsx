import Link from "next/link";
import { Suspense } from "react";
import TrendingSection from "@/components/homepage/TrendingSection";
import type { Metadata } from "next";
import HomepageFeed from "@/components/homepage/HomepageFeed";
import { SidebarHomepage } from "@/components/layout/Sidebar";
import { ReviewCardHomepage, type ReviewCardHomepageData } from "@/components/cards/ReviewCard";
import type { HomepageTopReviewer } from "@/components/layout/Sidebar";
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
import {
  getCategories,
  getLatestReviews,
  getPopularReviews,
} from "@/src/lib/api";
import { buildMetadata } from "@/src/lib/seo";
import { allowMockFallback } from "@/src/lib/runtime";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { homepageReviewCards } from "@/data/mock/reviews";
import { homepageTopReviewers } from "@/data/mock/users";
import { homepagePopularCategories } from "@/data/mock/categories";
import { t } from "@/src/lib/copy";

export const runtime = "edge";
export const revalidate = 60;

const HOMEPAGE_LIMIT = 9;
const POPULAR_LIMIT = 9;
const TRENDING_LIMIT = 3;

const ACTIVE_TRENDING_TAB_CLASS =
  "px-3 py-1.5 text-xs font-bold rounded-full bg-primary text-white shadow-sm transition-all";
const INACTIVE_TRENDING_TAB_CLASS =
  "px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-all";
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
  const filterParam =
    typeof searchParams?.filter === "string" ? searchParams.filter : undefined;
  const apiConfigured = true;
  let recentCards = allowMockFallback ? homepageReviewCards : [];
  let popularFeedCards = allowMockFallback ? homepageReviewCards : [];
  let topReviewers = allowMockFallback ? homepageTopReviewers : [];
  let popularCategories = allowMockFallback ? homepagePopularCategories : [];
  let categories: Category[] = allowMockFallback ? homepagePopularCategories : [];
  let trendingCards: ReviewCardHomepageData[] = [];
  let nextCursor: string | null = null;
  let errorMessage: string | null = null;

  const buildTrendingHref = (tab: TrendingTab) => {
    const params = new URLSearchParams();
    if (filterParam) {
      params.set("filter", filterParam);
    }
    if (tab !== DEFAULT_TRENDING_TAB) {
      params.set("trending", tab);
    }
    const query = params.toString();
    return localizePath(query ? `/?${query}` : "/", lang);
  };

  if (apiConfigured) {
    try {
      const [latestResult, popularReviews, categoryItems] =
        await Promise.all([
          getLatestReviews(HOMEPAGE_LIMIT, null, lang),
          getPopularReviews(
            POPULAR_LIMIT,
            lang,
            trendingTab === "popular6h"
              ? "6h"
              : trendingTab === "popular24h"
                ? "24h"
                : trendingTab === "popular1w"
                  ? "week"
                  : undefined
          ),
          getCategories(lang),
        ]);

      categories = categoryItems;
      const latestWithPhotos = filterReviewsWithPhotos(latestResult.items);
      const popularWithPhotos = filterReviewsWithPhotos(popularReviews);
      recentCards = buildHomepageCards(latestWithPhotos, categories, lang);
      popularFeedCards = buildHomepageCards(popularWithPhotos, categories, lang);
      nextCursor = latestResult.nextCursor;
      topReviewers = buildTopReviewers(
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
      if (e instanceof Error) {
        console.error("Homepage data fetch failed:", e.message);
        const detail = e.message;
        errorMessage = `${t(lang, "homepage.error.loadFailed")} (${detail})`;
      }
    }
  } else if (!allowMockFallback) {
    errorMessage = t(lang, "homepage.error.apiNotConfigured");
  }

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
        />

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 w-full lg:w-2/3">
            <Suspense fallback={<div className="animate-pulse space-y-4 shadow-sm h-64 bg-gray-100 rounded-lg" />}>
              <HomepageFeed
                categories={categories}
                initialCards={recentCards}
                initialNextCursor={nextCursor}
                initialPopularCards={popularFeedCards}
                pageSize={HOMEPAGE_LIMIT}
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
