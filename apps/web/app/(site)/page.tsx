import HomepageFeed from "@/components/homepage/HomepageFeed";
import Link from "next/link";
import type { Metadata } from "next";
import { SidebarHomepage } from "@/components/layout/Sidebar";
import type { ReviewCardHomepageData } from "@/components/cards/ReviewCard";
import type { HomepageTopReviewer } from "@/components/layout/Sidebar";
import type { Category, Review, StarType } from "@/src/types";
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
import { homepageReviewCards } from "@/data/mock/reviews";
import { homepageTopReviewers } from "@/data/mock/users";
import { homepagePopularCategories } from "@/data/mock/categories";

export const runtime = "edge";

const HOMEPAGE_LIMIT = 3;
const POPULAR_LIMIT = 6;
const TRENDING_LIMIT = 3;
const TRENDING_BADGES = [
  "bg-blue-100 text-blue-800",
  "bg-pink-100 text-pink-800",
  "bg-purple-100 text-purple-800",
];

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Home",
    description:
      "Discover honest reviews, trending products, and trusted recommendations.",
    path: "/",
    type: "website",
  });
}

function buildHomepageCards(
  reviews: Review[],
  categories: Category[]
): ReviewCardHomepageData[] {
  return reviews.map((review, index) => {
    const categoryName = getCategoryLabel(categories, review.categoryId);
    const relative = formatRelativeTime(review.createdAt);

    return {
      review,
      authorMeta: categoryName ? `Reviewer • ${categoryName}` : "Community Reviewer",
      postedLabel: relative ? `Posted ${relative}` : "Posted recently",
      ratingStars: buildRatingStars(review.ratingAvg),
      ratingValue: (review.ratingAvg ?? 0).toFixed(1),
      imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
      imageAlt: review.title,
      avatarUrl: review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index),
      avatarAlt: `Profile picture of ${review.author.username}`,
      badge: getHomepageBadge(review),
      likesLabel: formatCompactNumber(review.votesUp ?? 0),
      commentsLabel: formatCompactNumber(review.commentCount ?? 0),
      photoCountLabel:
        review.photoCount && review.photoCount > 0
          ? formatCompactNumber(review.photoCount)
          : undefined,
    };
  });
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
  fallback: HomepageTopReviewer[]
): HomepageTopReviewer[] {
  const reviewers: HomepageTopReviewer[] = [];
  const seen = new Set<string>();

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
      avatarAlt: `Profile picture of ${username}`,
      rankLabel: `#${reviewers.length + 1}`,
      reviewCountLabel: `${formatCompactNumber(review.ratingCount ?? 0)} Reviews`,
    });
    if (reviewers.length >= 3) {
      break;
    }
  }

  return reviewers.length > 0 ? reviewers : fallback;
}

type TrendingCard = {
  review: Review;
  categoryLabel: string;
  badgeClassName: string;
  imageUrl: string;
  imageAlt: string;
  excerpt: string;
  ratingStars: StarType[];
  ratingCountLabel: string;
};

function buildTrendingCards(
  reviews: Review[],
  categories: Category[]
): TrendingCard[] {
  return reviews.slice(0, TRENDING_LIMIT).map((review, index) => {
    const categoryLabel =
      getCategoryLabel(categories, review.categoryId) ?? "Community";
    const excerpt =
      review.excerpt?.trim() ||
      "Discover what the community is saying in this review.";

    return {
      review,
      categoryLabel,
      badgeClassName: pickFrom(TRENDING_BADGES, index),
      imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
      imageAlt: review.title,
      excerpt,
      ratingStars: buildRatingStars(review.ratingAvg),
      ratingCountLabel: formatCompactNumber(review.ratingCount ?? 0),
    };
  });
}

export default async function Page() {
  const apiConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
  let recentCards = allowMockFallback ? homepageReviewCards : [];
  let topReviewers = allowMockFallback ? homepageTopReviewers : [];
  let popularCategories = allowMockFallback ? homepagePopularCategories : [];
  let categories: Category[] = allowMockFallback ? homepagePopularCategories : [];
  let trendingCards = allowMockFallback
    ? buildTrendingCards(homepageReviewCards.map((card) => card.review), categories)
    : [];
  let nextCursor: string | null = null;
  let errorMessage: string | null = null;

  if (apiConfigured) {
    try {
      const [latestResult, popularReviews, categoryItems] = await Promise.all([
        getLatestReviews(HOMEPAGE_LIMIT),
        getPopularReviews(POPULAR_LIMIT),
        getCategories(),
      ]);

      categories = categoryItems;
      recentCards = buildHomepageCards(latestResult.items, categories);
      nextCursor = latestResult.nextCursor;
      topReviewers = buildTopReviewers(
        popularReviews,
        allowMockFallback ? homepageTopReviewers : []
      );
      trendingCards = buildTrendingCards(popularReviews, categories);
      popularCategories = categories.slice(0, 7);
    } catch (error) {
      console.error("Failed to load homepage API data", error);
      if (!allowMockFallback) {
        errorMessage = "Unable to load homepage data. Please try again later.";
      }
    }
  } else if (!allowMockFallback) {
    errorMessage = "API base URL is not configured.";
  }

  return (
    <div
      className="bg-surface-light dark:bg-background-dark font-display text-text-main antialiased min-h-screen flex flex-col"
      data-page="homepage"
    >
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {errorMessage ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {errorMessage}
          </div>
        ) : null}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-text-main dark:text-white mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">
              trending_up
            </span>
            Trending Now
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {trendingCards.map((card, index) => (
              <div
                key={`${card.review.id}-${index}`}
                className="group relative overflow-hidden rounded-xl bg-background-light dark:bg-surface-dark shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-800"
              >
                <Link href={`/content/${card.review.slug}`}>
                  <div
                    className="aspect-video w-full bg-cover bg-center cursor-pointer"
                    data-alt={card.imageAlt}
                    style={{ backgroundImage: `url("${card.imageUrl}")` }}
                  />
                </Link>
                <div className="p-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${card.badgeClassName} mb-2`}
                  >
                    {card.categoryLabel}
                  </span>
                  <h3 className="text-lg font-bold text-text-main dark:text-white leading-tight mb-1 hover:text-primary transition-colors cursor-pointer">
                    <Link href={`/content/${card.review.slug}`}>
                      {card.review.title}
                    </Link>
                  </h3>
                  <p className="text-sm text-text-muted">{card.excerpt}</p>
                  <div className="flex items-center mt-3 gap-1">
                    {card.ratingStars.map((star, starIndex) => {
                      const icon = star === "half" ? "star_half" : "star";
                      const className =
                        star === "empty"
                          ? "material-symbols-outlined star-empty text-[18px]"
                          : "material-symbols-outlined star-filled text-[18px]";
                      return (
                        <span key={`${card.review.id}-star-${starIndex}`} className={className}>
                          {icon}
                        </span>
                      );
                    })}
                    <span className="text-xs text-gray-500 ml-1">
                      ({card.ratingCountLabel} reviews)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 w-full lg:w-2/3">
            <HomepageFeed
              initialCards={recentCards}
              initialNextCursor={nextCursor}
              categories={categories}
              pageSize={HOMEPAGE_LIMIT}
            />
          </div>
          <SidebarHomepage
            topReviewers={topReviewers}
            popularCategories={popularCategories}
          />
        </div>
      </main>
    </div>
  );
}
