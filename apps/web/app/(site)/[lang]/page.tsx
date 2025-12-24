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
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { homepageReviewCards } from "@/data/mock/reviews";
import { homepageTopReviewers } from "@/data/mock/users";
import { homepagePopularCategories } from "@/data/mock/categories";
import { t } from "@/src/lib/copy";


const HOMEPAGE_LIMIT = 9;
const POPULAR_LIMIT = 9;
const TRENDING_LIMIT = 3;
const TRENDING_BADGES = [
  "bg-blue-100 text-blue-800",
  "bg-pink-100 text-pink-800",
  "bg-purple-100 text-purple-800",
];

type HomePageProps = {
  params: Promise<{ lang: string }>;
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

function getHomepageBadge(review: Review): "verified" | null {
  const rating = review.ratingAvg ?? 0;
  const ratingsCount = review.ratingCount ?? 0;
  if (rating >= 4.5 && ratingsCount >= 10) {
    return "verified";
  }
  return null;
}

function hasReviewImage(review: Review): boolean {
  return Array.isArray(review.photoUrls) && review.photoUrls.length > 0;
}

function mergeTrendingReviews(primary: Review[], fallback: Review[]): Review[] {
  const seen = new Set<string>();
  const combined: Review[] = [];

  const add = (review: Review) => {
    if (!hasReviewImage(review)) {
      return;
    }
    const key = review.id || review.slug;
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    combined.push(review);
  };

  primary.forEach(add);
  fallback.forEach(add);

  return combined;
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

type TrendingCard = {
  review: Review;
  href: string;
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
  categories: Category[],
  lang: string
): TrendingCard[] {
  const resolvedLang = normalizeLanguage(lang);
  return reviews
    .filter(hasReviewImage)
    .slice(0, TRENDING_LIMIT)
    .map((review, index) => {
      const categoryLabel =
        getCategoryLabel(categories, review.categoryId) ??
        t(resolvedLang, "homepage.trendingCategoryFallback");
      const excerpt =
        review.excerpt?.trim() ||
        t(resolvedLang, "homepage.trendingExcerptFallback");

      return {
        review,
        href: localizePath(`/content/${review.slug}`, lang),
        categoryLabel,
        badgeClassName: pickFrom(TRENDING_BADGES, index),
        imageUrl: review.photoUrls?.[0] ?? "",
        imageAlt: review.title,
        excerpt,
        ratingStars: buildRatingStars(review.ratingAvg),
        ratingCountLabel: formatCompactNumber(review.ratingCount ?? 0, resolvedLang),
      };
    });
}

export default async function Page(props: HomePageProps) {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  const apiConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
  let recentCards = allowMockFallback ? homepageReviewCards : [];
  let popularFeedCards = allowMockFallback ? homepageReviewCards : [];
  let topReviewers = allowMockFallback ? homepageTopReviewers : [];
  let popularCategories = allowMockFallback ? homepagePopularCategories : [];
  let categories: Category[] = allowMockFallback ? homepagePopularCategories : [];
  let trendingCards = allowMockFallback
    ? buildTrendingCards(homepageReviewCards.map((card) => card.review), categories, lang)
    : [];
  let nextCursor: string | null = null;
  let errorMessage: string | null = null;

  if (apiConfigured) {
    try {
      const [latestResult, popularReviews, categoryItems] = await Promise.all([
        getLatestReviews(HOMEPAGE_LIMIT, null, lang),
        getPopularReviews(POPULAR_LIMIT, lang),
        getCategories(lang),
      ]);

      categories = categoryItems;
      recentCards = buildHomepageCards(latestResult.items, categories, lang);
      popularFeedCards = buildHomepageCards(popularReviews, categories, lang);
      nextCursor = latestResult.nextCursor;
      topReviewers = buildTopReviewers(
        popularReviews,
        allowMockFallback ? homepageTopReviewers : [],
        lang
      );
      const trendingSource = mergeTrendingReviews(
        popularReviews,
        latestResult.items
      );
      trendingCards = buildTrendingCards(trendingSource, categories, lang);
      popularCategories = categories.slice(0, 7);
    } catch (error) {
      console.error("Failed to load homepage API data", error);
      if (!allowMockFallback) {
        errorMessage = t(lang, "homepage.error.loadFailed");
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
            {t(lang, "homepage.trendingTitle")}
          </h2>
          {trendingCards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-6 text-sm text-text-muted text-center">
              {t(lang, "homepage.trendingEmpty")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {trendingCards.map((card, index) => (
                <div
                  key={`${card.review.id}-${index}`}
                  className="group relative overflow-hidden rounded-xl bg-background-light dark:bg-surface-dark shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-800"
                >
                  <Link href={card.href}>
                    <div className="aspect-video w-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={card.imageAlt}
                        className="h-full w-full object-cover"
                        data-alt={card.imageAlt}
                        decoding="async"
                        fetchPriority={index === 0 ? "high" : "auto"}
                        loading={index === 0 ? "eager" : "lazy"}
                        src={card.imageUrl}
                      />
                    </div>
                  </Link>
                  <div className="p-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${card.badgeClassName} mb-2`}
                    >
                      {card.categoryLabel}
                    </span>
                    <h3 className="text-lg font-bold text-text-main dark:text-white leading-tight mb-1 hover:text-primary transition-colors cursor-pointer">
                      <Link href={card.href}>
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
                            : star === "half"
                            ? "material-symbols-outlined star-half text-secondary text-[18px]"
                            : "material-symbols-outlined star-filled text-secondary text-[18px]";
                        return (
                          <span key={`${card.review.id}-star-${starIndex}`} className={className}>
                            {icon}
                          </span>
                        );
                      })}
                      <span className="text-xs text-gray-500 ml-1">
                        {t(lang, "homepage.ratingCountLabel", {
                          count: card.ratingCountLabel,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 w-full lg:w-2/3">
            <HomepageFeed
              initialCards={recentCards}
              initialNextCursor={nextCursor}
              initialPopularCards={popularFeedCards}
              categories={categories}
              pageSize={HOMEPAGE_LIMIT}
            />
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
