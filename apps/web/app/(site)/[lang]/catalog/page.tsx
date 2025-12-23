import { ReviewListCatalog } from "@/components/lists/ReviewList";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import type { Metadata } from "next";
import { SidebarCatalog } from "@/components/layout/Sidebar";
import {
  CatalogCategoryChips,
  CatalogSortSelect,
} from "@/components/catalog/CatalogFilters";
import type { ReviewCardCatalogData } from "@/components/cards/ReviewCard";
import type { CatalogPopularTopic, CatalogTopAuthor } from "@/components/layout/Sidebar";
import type { Category, Review } from "@/src/types";
import { Suspense } from "react";
import {
  FALLBACK_AVATARS,
  FALLBACK_REVIEW_IMAGES,
  buildRatingStars,
  formatCompactNumber,
  formatRelativeTime,
  getCategoryLabel,
  getCategoryMeta,
  pickFrom,
} from "@/src/lib/review-utils";
import {
  getCatalogPage,
  getCategories,
  getPopularReviews,
} from "@/src/lib/api";
import { buildMetadata } from "@/src/lib/seo";
import { allowMockFallback } from "@/src/lib/runtime";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import {
  catalogReviewCards,
  catalogPagination,
  catalogPopularTopics,
} from "@/data/mock/reviews";
import { catalogTopAuthors } from "@/data/mock/users";


const DEFAULT_PAGE_SIZE = 10;
const POPULAR_LIMIT = 4;
const DEFAULT_SORT = "latest" as const;
const SORT_OPTIONS = [
  { label: "Newest Reviews", value: "latest", apiValue: "latest" },
  { label: "Highest Rated", value: "rating", apiValue: "rating" },
  { label: "Most Discussed", value: "popular", apiValue: "popular" },
  { label: "Trending Now", value: "trending", apiValue: "popular" },
] as const;
const SORT_PARAM_VALUES = new Set<CatalogSortParam>(
  SORT_OPTIONS.map((option) => option.value)
);
const CATEGORY_PILL_LABELS = [
  "All",
  "Beauty",
  "Technology",
  "Travel",
  "Automotive",
  "Books",
  "Health",
  "Movies",
];

export async function generateMetadata({ params }: CatalogPageProps): Promise<Metadata> {
  const lang = normalizeLanguage((await params).lang);
  return buildMetadata({
    title: "Catalog",
    description: "Browse the latest reviews across every category.",
    path: "/catalog",
    lang,
    type: "website",
  });
}

const TOP_AUTHOR_RANKS = [
  "absolute -bottom-1 -right-1 bg-yellow-400 text-[8px] font-bold text-slate-900 px-1 rounded-full",
  "absolute -bottom-1 -right-1 bg-slate-300 text-[8px] font-bold text-slate-900 px-1 rounded-full",
  "absolute -bottom-1 -right-1 bg-orange-700 text-[8px] font-bold text-white px-1 rounded-full",
];

type CatalogPageProps = {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    sort?: string;
    categoryId?: string;
  }>;
};

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseOptionalNumber(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.floor(parsed);
}

type CatalogSortParam = "latest" | "popular" | "rating" | "trending";

function isCatalogSortParam(value: string): value is CatalogSortParam {
  return SORT_PARAM_VALUES.has(value as CatalogSortParam);
}

function parseSort(value?: string): CatalogSortParam {
  const normalized = value?.toLowerCase();
  if (normalized && isCatalogSortParam(normalized)) {
    return normalized;
  }
  return DEFAULT_SORT;
}

function mapSortToApi(sort: CatalogSortParam): "latest" | "popular" | "rating" {
  const match = SORT_OPTIONS.find((option) => option.value === sort);
  return match ? match.apiValue : DEFAULT_SORT;
}

function buildCategoryPills(categories: Category[]) {
  const topLevel = categories.filter((category) => !category.parentId);
  if (topLevel.length === 0) {
    return CATEGORY_PILL_LABELS.map((label) => ({
      label,
      id: undefined,
    }));
  }
  const limit = Math.max(0, CATEGORY_PILL_LABELS.length - 1);
  return [
    { label: "All", id: undefined },
    ...topLevel.slice(0, limit).map((category) => ({
      label: category.name,
      id: category.id,
    })),
  ];
}

function buildCatalogCards(
  reviews: Review[],
  categories: Category[],
  lang: string
): ReviewCardCatalogData[] {
  return reviews.map((review, index) => {
    const categoryLabel = getCategoryLabel(categories, review.categoryId);
    const categoryMeta = getCategoryMeta(categoryLabel);

    return {
      review,
      href: localizePath(`/content/${review.slug}`, lang),
      dateLabel: formatRelativeTime(review.createdAt),
      ratingStars: buildRatingStars(review.ratingAvg),
      ratingValue: (review.ratingAvg ?? 0).toFixed(1),
      imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
      imageAlt: review.title,
      authorAvatarAlt: `${review.author.username} Avatar`,
      authorAvatarDataAlt: `Avatar of user ${review.author.username}`,
      authorAvatarUrl:
        review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index),
      category: categoryMeta,
      viewsLabel: formatCompactNumber(review.views ?? 0),
      likesLabel: formatCompactNumber(review.votesUp ?? 0),
      showImageOverlay: Boolean(review.photoCount && review.photoCount > 1),
    };
  });
}

function buildPopularTopics(
  reviews: Review[],
  categories: Category[]
): CatalogPopularTopic[] {
  return reviews.map((review, index) => {
    const categoryLabel = getCategoryLabel(categories, review.categoryId) ?? "General";
    return {
      slug: review.slug,
      rankLabel: String(index + 1).padStart(2, "0"),
      title: review.title,
      metaLabel: `${categoryLabel} • ${formatCompactNumber(review.ratingCount ?? 0)} ratings`,
    };
  });
}

function buildTopAuthors(
  reviews: Review[],
  fallback: CatalogTopAuthor[]
): CatalogTopAuthor[] {
  const authors: CatalogTopAuthor[] = [];
  const seen = new Set<string>();

  for (const review of reviews) {
    const username = review.author.username;
    if (!username || seen.has(username)) {
      continue;
    }
    seen.add(username);

    const rankIndex = authors.length;
    authors.push({
      profile: {
        username,
        displayName: review.author.displayName ?? username,
      },
      avatarUrl:
        review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, rankIndex),
      avatarAlt: `${username} Avatar`,
      avatarDataAlt: `Avatar of user ${username}`,
      rankLabel: `#${rankIndex + 1}`,
      rankClassName: TOP_AUTHOR_RANKS[rankIndex] ?? TOP_AUTHOR_RANKS[0],
      reviewsLabel: `${formatCompactNumber(review.ratingCount ?? 0)} reviews`,
      karmaLabel: `${formatCompactNumber(review.votesUp ?? 0)} karma`,
    });

    if (authors.length >= 3) {
      break;
    }
  }

  return authors.length > 0 ? authors : fallback;
}

export default async function Page(props: CatalogPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const sort = parseSort(searchParams?.sort);
  const categoryId = parseOptionalNumber(searchParams?.categoryId);
  const apiSort = mapSortToApi(sort);

  const apiConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
  let cards = allowMockFallback ? catalogReviewCards : [];
  let pagination = allowMockFallback
    ? catalogPagination
    : { page, pageSize, totalPages: 0, totalItems: 0 };
  let popularTopics = allowMockFallback ? catalogPopularTopics : [];
  let topAuthors = allowMockFallback ? catalogTopAuthors : [];
  let categories: Category[] = [];
  let errorMessage: string | null = null;

  if (apiConfigured) {
    try {
      const [catalogResult, popularReviews, categoryItems] = await Promise.all([
        getCatalogPage(page, pageSize, apiSort, categoryId, lang),
        getPopularReviews(POPULAR_LIMIT, lang),
        getCategories(lang),
      ]);

      categories = categoryItems;
      cards = buildCatalogCards(catalogResult.items, categories, lang);
      pagination = catalogResult.pageInfo;
      popularTopics = buildPopularTopics(popularReviews, categories);
      topAuthors = buildTopAuthors(
        popularReviews,
        allowMockFallback ? catalogTopAuthors : []
      );
    } catch (error) {
      console.error("Failed to load catalog API data", error);
      if (!allowMockFallback) {
        errorMessage = "Unable to load catalog data. Please try again later.";
      }
    }
  } else if (!allowMockFallback) {
    errorMessage = "API base URL is not configured.";
  }

  const categoryPills = buildCategoryPills(categories);
  const totalReviews = pagination.totalItems ?? 0;
  const catalogSubtitle =
    totalReviews > 0
      ? `Discover ${formatCompactNumber(totalReviews)} reviews from our community.`
      : "Discover honest reviews from our community.";
  const baseParams = new URLSearchParams();
  if (searchParams?.pageSize) {
    baseParams.set("pageSize", String(pageSize));
  }
  if (sort !== DEFAULT_SORT) {
    baseParams.set("sort", sort);
  }
  if (categoryId) {
    baseParams.set("categoryId", String(categoryId));
  }
  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(targetPage));
    return localizePath(`/catalog?${params.toString()}`, lang);
  };

  return (
    <div
      className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-50 font-display min-h-screen flex flex-col"
      data-page="catalog-page"
    >
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {errorMessage ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {errorMessage}
          </div>
        ) : null}
        <nav aria-label="Breadcrumb" className="flex mb-6">
          <ol className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
            <li>
              <Link
                className="hover:text-primary flex items-center"
                href={localizePath("/", lang)}
              >
                <span className="material-symbols-outlined text-[18px] mr-1">
                  home
                </span>
                Home
              </Link>
            </li>
            <li>
              <span className="mx-1">/</span>
            </li>
            <li className="font-medium text-slate-900 dark:text-slate-200">
              Catalog
            </li>
          </ol>
        </nav>
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
                Review Catalog
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                {catalogSubtitle}
              </p>
            </div>
            <Suspense fallback={null}>
              <CatalogSortSelect
                sort={sort}
                options={SORT_OPTIONS.map(({ label, value }) => ({
                  label,
                  value,
                }))}
              />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <CatalogCategoryChips categoryId={categoryId} pills={categoryPills} />
          </Suspense>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {cards.length > 0 ? (
            <ReviewListCatalog
              cards={cards}
              pagination={pagination}
              buildHref={buildHref}
            />
          ) : (
            <div className="lg:col-span-8">
              <EmptyState
                title="No reviews yet"
                description="There are no reviews yet in this category. Be the first to write one!"
                ctaLabel="Write the first review"
                authenticatedHref="/node/add/review"
              />
            </div>
          )}
          <SidebarCatalog
            lang={lang}
            popularTopics={popularTopics}
            topAuthors={topAuthors}
          />
        </div>
      </main>
    </div>
  );
}
