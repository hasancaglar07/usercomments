import Link from "next/link";
import { ReviewListCategory } from "@/components/lists/ReviewList";
import type { Metadata } from "next";
import { SidebarCategory } from "@/components/layout/Sidebar";
import type {
  CategoryBestItem,
  CategoryTopAuthor,
} from "@/components/layout/Sidebar";
import {
  ReviewCardCategory,
  type ReviewCardCategoryData,
} from "@/components/cards/ReviewCard";
import type { Category, Review } from "@/src/types";
import {
  FALLBACK_AVATARS,
  FALLBACK_REVIEW_IMAGES,
  buildRatingStars,
  formatCompactNumber,
  formatNumber,
  formatRelativeTime,
  getCategoryMeta,
  getCategoryLabel,
  pickFrom,
} from "@/src/lib/review-utils";
import {
  getCategories,
  getCategoryPage,
  getSubcategories,
} from "@/src/lib/api";
import { buildMetadata, toAbsoluteUrl } from "@/src/lib/seo";
import { allowMockFallback } from "@/src/lib/runtime";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";
import {
  categoryReviewCards,
  categoryPagination,
  categoryBestItems,
} from "@/data/mock/reviews";
import { categoryTopAuthors } from "@/data/mock/users";
import { categoryPopularTags } from "@/data/mock/categories";

export const revalidate = 60;

const DEFAULT_PAGE_SIZE = 10;
const POPULAR_REVIEWS_LIMIT = 3;

const SORT_OPTIONS = new Set(["latest", "popular", "rating"]);

export async function generateMetadata(
  props: CategoryPageProps
): Promise<Metadata> {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const sort = parseSort(searchParams?.sort);
  const subCategoryId = parseOptionalNumber(searchParams?.subCategoryId);
  const categoryId = Number(params.id);
  let categoryLabel: string | undefined;

  if (process.env.NEXT_PUBLIC_API_BASE_URL && Number.isFinite(categoryId)) {
    try {
      const categories = await getCategories(lang);
      categoryLabel = getCategoryLabel(categories, categoryId);
    } catch {
      categoryLabel = undefined;
    }
  }

  const title = categoryLabel
    ? t(lang, "category.meta.titleWithLabel", { label: categoryLabel })
    : t(lang, "category.meta.titleDefault");

  const metadata = buildMetadata({
    title,
    description: categoryLabel
      ? t(lang, "category.meta.descriptionWithLabel", { label: categoryLabel })
      : t(lang, "category.meta.descriptionDefault"),
    path: `/catalog/reviews/${params.id}`,
    lang,
    type: "website",
  });
  const isIndexable =
    page === 1 &&
    pageSize === DEFAULT_PAGE_SIZE &&
    sort === "latest" &&
    !subCategoryId;

  if (!isIndexable) {
    return {
      ...metadata,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  return metadata;
}

type CategoryPageProps = {
  params: Promise<{
    lang: string;
    id: string;
  }>;
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    sort?: string;
    subCategoryId?: string;
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

function parseSort(value?: string): "latest" | "popular" | "rating" {
  const normalized = value?.toLowerCase();
  if (normalized && SORT_OPTIONS.has(normalized)) {
    return normalized as "latest" | "popular" | "rating";
  }
  return "latest";
}

function buildCategoryCards(
  reviews: Review[],
  categories: Category[],
  subcategories: Category[],
  lang: string
): ReviewCardCategoryData[] {
  const resolvedLang = normalizeLanguage(lang);
  return reviews.map((review, index) => {
    const subCategoryLabel = getCategoryLabel(subcategories, review.subCategoryId);
    const categoryLabel = getCategoryLabel(categories, review.categoryId);

    return {
      review,
      href: localizePath(`/content/${review.slug}`, lang),
      dateLabel: formatRelativeTime(review.createdAt, resolvedLang),
      ratingStars: buildRatingStars(review.ratingAvg),
      imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
      imageAlt: review.title,
      avatarUrl: review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index),
      avatarAlt: t(resolvedLang, "category.card.avatarAlt", {
        username: review.author.username,
      }),
      tagLabel: subCategoryLabel ?? categoryLabel ?? t(resolvedLang, "common.general"),
      likesLabel: formatCompactNumber(review.votesUp ?? 0, resolvedLang),
      commentsLabel: formatCompactNumber(review.commentCount ?? 0, resolvedLang),
    };
  });
}

function buildBestItems(reviews: Review[], lang: string): CategoryBestItem[] {
  const resolvedLang = normalizeLanguage(lang);
  const sorted = [...reviews].sort((a, b) => {
    const left = a.ratingAvg ?? 0;
    const right = b.ratingAvg ?? 0;
    return right - left;
  });

  return sorted.slice(0, 3).map((review, index) => ({
    review,
    rankLabel: String(index + 1),
    imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
    imageAlt: review.title,
    ratingLabel: (review.ratingAvg ?? 0).toFixed(1),
    ratingCountLabel: `(${formatNumber(review.ratingCount ?? 0, resolvedLang)})`,
  }));
}

function buildTopAuthors(
  reviews: Review[],
  fallback: CategoryTopAuthor[],
  lang: string
): CategoryTopAuthor[] {
  const authors: CategoryTopAuthor[] = [];
  const seen = new Set<string>();
  const resolvedLang = normalizeLanguage(lang);

  for (const review of reviews) {
    const username = review.author.username;
    if (!username || seen.has(username)) {
      continue;
    }
    seen.add(username);

    authors.push({
      profile: {
        username,
        displayName: review.author.displayName ?? username,
      },
      avatarUrl:
        review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, authors.length),
      avatarAlt: t(resolvedLang, "category.card.avatarAlt", { username }),
      reviewsLabel: t(resolvedLang, "catalog.topAuthorReviews", {
        count: formatCompactNumber(review.ratingCount ?? 0, resolvedLang),
      }),
    });

    if (authors.length >= 2) {
      break;
    }
  }

  return authors.length > 0 ? authors : fallback;
}

export default async function Page(props: CategoryPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const sort = parseSort(searchParams?.sort);
  const subCategoryId = parseOptionalNumber(searchParams?.subCategoryId);
  const categoryId = Number(params.id);

  const apiConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
  const fallbackCategoryLabel = allowMockFallback
    ? t(lang, "category.fallback.labelMock")
    : t(lang, "category.fallback.label");
  const fallbackDescription = allowMockFallback
    ? t(lang, "category.fallback.descriptionMock")
    : t(lang, "category.fallback.description");
  let categoryLabel = fallbackCategoryLabel;
  let categoryDescription = fallbackDescription;
  let cards = allowMockFallback ? categoryReviewCards : [];
  let popularCards: ReviewCardCategoryData[] = [];
  let pagination = allowMockFallback
    ? categoryPagination
    : { page, pageSize, totalPages: 0, totalItems: 0 };
  let bestItems = allowMockFallback ? categoryBestItems : [];
  let topAuthors = allowMockFallback ? categoryTopAuthors : [];
  let popularTags = allowMockFallback ? categoryPopularTags : [];
  let subcategoryTags = allowMockFallback ? categoryPopularTags : [];
  let errorMessage: string | null = null;

  if (apiConfigured && Number.isFinite(categoryId)) {
    try {
      const popularResultPromise =
        sort === "popular"
          ? Promise.resolve(null)
          : getCategoryPage(
            categoryId,
            1,
            POPULAR_REVIEWS_LIMIT,
            "popular",
            undefined,
            lang
          ).catch(() => null);
      const [categoryResult, categories, subcategories, popularResult] =
        await Promise.all([
          getCategoryPage(categoryId, page, pageSize, sort, subCategoryId, lang),
          getCategories(lang),
          getSubcategories(categoryId, lang),
          popularResultPromise,
        ]);

      cards = buildCategoryCards(categoryResult.items, categories, subcategories, lang);
      pagination = categoryResult.pageInfo;
      bestItems = buildBestItems(categoryResult.items, lang);
      topAuthors = buildTopAuthors(
        categoryResult.items,
        allowMockFallback ? categoryTopAuthors : [],
        lang
      );
      const label = getCategoryLabel(categories, categoryId);
      if (label) {
        categoryLabel = label;
        categoryDescription = t(lang, "category.description.withLabel", { label });
      }
      subcategoryTags = subcategories;
      popularTags =
        subcategories.length > 0 ? subcategories : categories.slice(0, 6);
      const popularReviews =
        sort === "popular"
          ? categoryResult.items.slice(0, POPULAR_REVIEWS_LIMIT)
          : popularResult?.items ?? [];
      popularCards = buildCategoryCards(
        popularReviews,
        categories,
        subcategories,
        lang
      );
    } catch (error) {
      console.error("Failed to load category API data", error);
      if (!allowMockFallback) {
        errorMessage = t(lang, "category.error.loadFailed");
      }
    }
  } else if (!allowMockFallback) {
    errorMessage = t(lang, "category.error.apiNotConfigured");
  }

  const baseParams = new URLSearchParams();
  if (pageSize !== DEFAULT_PAGE_SIZE) {
    baseParams.set("pageSize", String(pageSize));
  }
  if (sort !== "latest") {
    baseParams.set("sort", sort);
  }
  if (subCategoryId) {
    baseParams.set("subCategoryId", String(subCategoryId));
  }
  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(targetPage));
    return localizePath(`/catalog/reviews/${categoryId}?${params.toString()}`, lang);
  };
  const buildFilterHref = (targetSubCategoryId?: number) => {
    const params = new URLSearchParams(baseParams);
    params.set("page", "1");
    if (targetSubCategoryId) {
      params.set("subCategoryId", String(targetSubCategoryId));
    } else {
      params.delete("subCategoryId");
    }
    return localizePath(`/catalog/reviews/${categoryId}?${params.toString()}`, lang);
  };
  const popularCategoryLabel = categoryLabel ?? t(lang, "common.general");
  const popularCategoryHref = localizePath(`/catalog/reviews/${categoryId}`, lang);
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t(lang, "category.meta.titleWithLabel", { label: categoryLabel }),
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: cards.length,
    itemListElement: cards.map((card, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: toAbsoluteUrl(card.href),
    })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: t(lang, "category.breadcrumb.home"),
        item: toAbsoluteUrl(localizePath("/", lang)),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t(lang, "category.breadcrumb.reviews"),
        item: toAbsoluteUrl(localizePath("/catalog", lang)),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: categoryLabel,
        item: toAbsoluteUrl(localizePath(`/catalog/reviews/${categoryId}`, lang)),
      },
    ],
  };

  return (
    <div
      className="bg-background-light dark:bg-background-dark text-[#0d141b] font-display antialiased overflow-x-hidden"
      data-page="category-page"
    >
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbJsonLd)}
      </script>
      <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-10 py-6">
          <div className="mb-8 bg-surface-light dark:bg-surface-dark rounded-2xl p-6 md:p-10 shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="flex flex-wrap gap-2 pb-6 relative z-10">
              <Link
                className="text-gray-500 dark:text-gray-400 text-sm font-medium hover:text-primary transition-colors flex items-center"
                href={localizePath("/", lang)}
              >
                <span className="material-symbols-outlined text-[18px] mr-1">
                  home
                </span>
                {t(lang, "category.breadcrumb.home")}
              </Link>
              <span className="text-gray-300 dark:text-gray-600 text-sm font-medium">/</span>
              <Link
                className="text-gray-500 dark:text-gray-400 text-sm font-medium hover:text-primary hover:underline"
                href={localizePath("/catalog", lang)}
              >
                {t(lang, "category.breadcrumb.reviews")}
              </Link>
              <span className="text-gray-300 dark:text-gray-600 text-sm font-medium">/</span>
              <span className="text-gray-900 dark:text-gray-100 text-sm font-medium">
                {categoryLabel}
              </span>
            </div>

            <div className="flex flex-col gap-6 relative z-10">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="max-w-3xl">
                  <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tight text-gray-900 dark:text-white mb-4">
                    {categoryLabel}
                  </h1>
                  <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed">
                    {categoryDescription}
                  </p>
                </div>

                <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-lg self-start shrink-0">
                  <Link
                    className="flex h-9 items-center justify-center rounded-md bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white px-5 text-sm font-bold transition-all"
                    href={localizePath(`/catalog/reviews/${categoryId}`, lang)}
                  >
                    {t(lang, "category.tab.reviews")}
                  </Link>
                  <Link
                    className="flex h-9 items-center justify-center rounded-md px-5 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-primary transition-colors"
                    href={localizePath(`/catalog/list/${categoryId}`, lang)}
                  >
                    {t(lang, "category.tab.products")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="sticky top-[65px] z-40 bg-background-light py-4 -mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <Link
                className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full px-5 transition-transform hover:scale-105 ${subCategoryId
                  ? "bg-white border border-[#e7edf3] hover:border-primary hover:text-primary transition-all"
                  : "bg-[#0d141b] text-white"
                  }`}
                href={buildFilterHref()}
              >
                <p className="text-sm font-bold">{t(lang, "category.filter.all")}</p>
              </Link>
              {subcategoryTags.map((tag) => {
                const isActive = tag.id === subCategoryId;
                const meta = getCategoryMeta(tag.name);
                return (
                  <Link
                    key={tag.id}
                    className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full px-5 transition-all ${isActive
                      ? "bg-[#0d141b] text-white"
                      : "bg-white border border-[#e7edf3] hover:border-primary hover:text-primary group"
                      }`}
                    href={buildFilterHref(tag.id)}
                  >
                    <span
                      className={`material-symbols-outlined text-[18px] ${isActive ? "text-white" : "group-hover:text-primary"
                        }`}
                    >
                      {meta.icon}
                    </span>
                    <p className="text-sm font-medium">{tag.name}</p>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
            <ReviewListCategory
              cards={cards}
              pagination={pagination}
              buildHref={buildHref}
              sort={sort}
              lang={lang}
            />
            <SidebarCategory
              lang={lang}
              bestItems={bestItems}
              topAuthors={topAuthors}
              popularTags={popularTags}
              baseCategoryId={categoryId}
            />
          </div>
          {popularCards.length > 0 ? (
            <section className="mt-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-[#0d141b]">
                    {t(lang, "category.popular.title")}
                  </h2>
                  <p className="text-sm text-[#4c739a]">
                    {t(lang, "category.popular.subtitle", {
                      category: popularCategoryLabel,
                    })}
                  </p>
                </div>
                <Link
                  href={popularCategoryHref}
                  className="text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
                >
                  {t(lang, "category.popular.viewAll")}
                </Link>
              </div>
              <div className="mt-6 flex flex-col gap-4">
                {popularCards.map((card) => (
                  <ReviewCardCategory key={card.review.id} {...card} />
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
