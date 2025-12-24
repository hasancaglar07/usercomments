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
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

export const revalidate = 30;


type SearchPageProps = {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{
    q?: string;
    page?: string;
    pageSize?: string;
    categoryId?: string;
  }>;
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

export default async function Page(props: SearchPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
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
        searchReviews(query, page, pageSize, categoryId, lang),
        getCategories(lang),
      ]);
      results = result.items;
      pagination = result.pageInfo;
      categories = categoryItems;
    } catch (error) {
      console.error("Failed to load search results", error);
      if (!allowMockFallback) {
        errorMessage = t(lang, "search.error.loadFailed");
      }
    }
  } else if (query && !allowMockFallback) {
    errorMessage = t(lang, "search.error.apiNotConfigured");
  }

  const cards: ReviewCardCatalogData[] = results.map((review, index) => {
    const categoryLabel = getCategoryLabel(categories, review.categoryId);
    const categoryMeta = getCategoryMeta(categoryLabel);

    return {
      review,
      href: localizePath(`/content/${review.slug}`, lang),
      dateLabel: formatRelativeTime(review.createdAt, lang),
      ratingStars: buildRatingStars(review.ratingAvg),
      ratingValue: (review.ratingAvg ?? 0).toFixed(1),
      imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
      imageAlt: review.title,
      authorAvatarAlt: t(lang, "catalog.avatarAlt", {
        username: review.author.username,
      }),
      authorAvatarDataAlt: t(lang, "catalog.avatarDataAlt", {
        username: review.author.username,
      }),
      authorAvatarUrl:
        review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index),
      category: categoryMeta,
      viewsLabel: formatCompactNumber(review.views ?? 0, lang),
      likesLabel: formatCompactNumber(review.votesUp ?? 0, lang),
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
        <h1 className="text-2xl font-bold mb-2">{t(lang, "search.heading")}</h1>
        <p className="text-slate-500 dark:text-slate-400">
          {query ? (
            <>
              {t(lang, "search.resultsFor")}{" "}
              <span className="font-semibold">{query}</span>
            </>
          ) : (
            t(lang, "search.prompt")
          )}
        </p>
        {query ? (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t(lang, "search.categoryLabel")}
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
                  return localizePath(`/search?${params.toString()}`, lang);
                }}
              />
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title={t(lang, "search.empty.title")}
                description={t(lang, "search.empty.description")}
                ctaLabel={t(lang, "search.empty.cta")}
                authenticatedHref="/node/add/review"
              />
            </div>
          )
        ) : null}
      </main>
    </div>
  );
}

export async function generateMetadata(
  props: SearchPageProps
): Promise<Metadata> {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const query = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const title = query
    ? t(lang, "search.meta.titleWithQuery", { query })
    : t(lang, "search.meta.title");
  const description = query
    ? t(lang, "search.meta.descriptionWithQuery", { query })
    : t(lang, "search.meta.description");
  const metadata = buildMetadata({
    title,
    description,
    path: "/search",
    lang,
    type: "website",
  });

  return {
    ...metadata,
    robots: {
      index: false,
      follow: true,
    },
  };
}
