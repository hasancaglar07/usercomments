import { ReviewListCatalog } from "@/components/lists/ReviewList";
import SearchCategoryFilter from "@/components/search/SearchCategoryFilter";
import EmptyState from "@/components/ui/EmptyState";
import type { ReviewCardCatalogData } from "@/components/cards/ReviewCard";
import type { Metadata } from "next";
import type { Category, PaginationInfo, Review } from "@/src/types";
import { getCategories, searchReviews } from "@/src/lib/api";
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
import { buildMetadata } from "@/src/lib/seo";
import { allowMockFallback } from "@/src/lib/runtime";
import { homepagePopularCategories } from "@/data/mock/categories";

export const runtime = "edge";

type SearchPageProps = {
  searchParams?: {
    q?: string;
    page?: string;
    pageSize?: string;
    categoryId?: string;
  };
};

const DEFAULT_PAGE_SIZE = 10;

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

export default async function Page({ searchParams }: SearchPageProps) {
  const query = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const categoryId = parseOptionalNumber(searchParams?.categoryId);

  let results: Review[] = [];
  let pagination: PaginationInfo = {
    page,
    pageSize,
    totalPages: 0,
    totalItems: 0,
  };
  const apiConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
  let categories: Category[] = allowMockFallback ? homepagePopularCategories : [];
  let errorMessage: string | null = null;

  if (query && apiConfigured) {
    try {
      const [result, categoryItems] = await Promise.all([
        searchReviews(query, page, pageSize, categoryId),
        getCategories(),
      ]);
      results = result.items;
      pagination = result.pageInfo;
      categories = categoryItems;
    } catch (error) {
      console.error("Failed to load search results", error);
      if (!allowMockFallback) {
        errorMessage = "Unable to load search results. Please try again later.";
      }
    }
  } else if (query && !allowMockFallback) {
    errorMessage = "API base URL is not configured.";
  }

  const cards: ReviewCardCatalogData[] = results.map((review, index) => {
    const categoryLabel = getCategoryLabel(categories, review.categoryId);
    const categoryMeta = getCategoryMeta(categoryLabel);

    return {
      review,
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

  return (
    <div
      className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen"
      data-page="search"
    >
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {errorMessage ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {errorMessage}
          </div>
        ) : null}
        <h1 className="text-2xl font-bold mb-2">Search</h1>
        <p className="text-slate-500 dark:text-slate-400">
          {query ? (
            <>
              Showing results for: <span className="font-semibold">{query}</span>
            </>
          ) : (
            "Enter a search term to see results."
          )}
        </p>
        {query ? (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Category
            </span>
            <Suspense fallback={null}>
              <SearchCategoryFilter
                categories={categories}
                selectedId={categoryId}
              />
            </Suspense>
          </div>
        ) : null}
        {query ? (
          cards.length > 0 ? (
            <div className="mt-6">
              <ReviewListCatalog
                cards={cards}
                pagination={pagination}
                buildHref={(targetPage) => {
                  const params = new URLSearchParams();
                  params.set("q", query);
                  if (searchParams?.pageSize) {
                    params.set("pageSize", String(pageSize));
                  }
                  if (categoryId) {
                    params.set("categoryId", String(categoryId));
                  }
                  params.set("page", String(targetPage));
                  return `/search?${params.toString()}`;
                }}
              />
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="No results found"
                description="Try a different search term or be the first to share your experience on this topic."
                ctaLabel="Write review"
                authenticatedHref="/node/add/review"
              />
            </div>
          )
        ) : null}
      </main>
    </div>
  );
}

export function generateMetadata({
  searchParams,
}: SearchPageProps): Metadata {
  const query = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const title = query ? `Search: ${query}` : "Search";
  const description = query
    ? `Search results for "${query}".`
    : "Search reviews and recommendations.";
  const path = query ? `/search?q=${encodeURIComponent(query)}` : "/search";

  return buildMetadata({
    title,
    description,
    path,
    type: "website",
  });
}
