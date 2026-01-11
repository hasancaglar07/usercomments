export const runtime = 'edge';

import Link from "next/link";
import { notFound } from "next/navigation";
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
  getCategoriesDirect,
  getCategoryPageDirect,
  getSubcategoriesDirect,
} from "@/src/lib/api-direct";
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
  let categoryMissing = false;
  const isValidCategoryId = Number.isFinite(categoryId) && categoryId > 0;

  if (!isValidCategoryId) {
    const metadata = buildMetadata({
      title: t(lang, "category.meta.titleDefault"),
      description: t(lang, "category.meta.descriptionDefault"),
      path: `/catalog/reviews/${params.id}`,
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

  if (process.env.NEXT_PUBLIC_API_BASE_URL && Number.isFinite(categoryId)) {
    try {
      const categories = await getCategoriesDirect(lang);
      categoryLabel = getCategoryLabel(categories, categoryId);
      categoryMissing = categories.length > 0 && !categoryLabel;
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

  if (!isIndexable || categoryMissing) {
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
  const isValidCategoryId = Number.isFinite(categoryId) && categoryId > 0;

  if (!isValidCategoryId) {
    notFound();
  }

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

  if (apiConfigured && Number.isFinite(categoryId)) {
    try {
      const popularResultPromise =
        sort === "popular"
          ? Promise.resolve(null)
          : getCategoryPageDirect(
            categoryId,
            1,
            POPULAR_REVIEWS_LIMIT,
            "popular",
            undefined,
            lang
          ).catch(() => null);
      const [categoryResult, categories, subcategories, popularResult] =
        await Promise.all([
          getCategoryPageDirect(categoryId, page, pageSize, sort, subCategoryId, lang),
          getCategoriesDirect(lang),
          getSubcategoriesDirect(categoryId, lang),
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
      if (!label && categories.length > 0) {
        notFound();
      }
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
    }
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
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8">
          {/* Breadcrumbs */}
          <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-sub dark:text-gray-400 mb-8">
            <Link
              className="hover:text-primary transition-colors"
              href={localizePath("/", lang)}
            >
              {t(lang, "category.breadcrumb.home")}
            </Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <Link
              className="hover:text-primary transition-colors"
              href={localizePath("/catalog", lang)}
            >
              {t(lang, "category.breadcrumb.reviews")}
            </Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-text-main dark:text-white font-bold">
              {categoryLabel}
            </span>
          </nav>

          <header className="mb-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-3xl">
                <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight text-text-main dark:text-white mb-4">
                  {categoryLabel}
                </h1>
                <p className="text-lg md:text-xl text-text-sub dark:text-gray-400 leading-relaxed font-medium">
                  {categoryDescription}
                </p>
              </div>

              <div className="flex p-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl shrink-0">
                <Link
                  className="flex items-center justify-center px-6 py-2.5 rounded-lg bg-white dark:bg-surface-dark shadow-sm text-text-main dark:text-white text-sm font-bold transition-all"
                  href={localizePath(`/catalog/reviews/${categoryId}`, lang)}
                >
                  {t(lang, "category.tab.reviews")}
                </Link>
                <Link
                  className="flex items-center justify-center px-6 py-2.5 rounded-lg text-sm font-bold text-text-sub dark:text-gray-400 hover:text-primary transition-colors"
                  href={localizePath(`/catalog/list/${categoryId}`, lang)}
                >
                  {t(lang, "category.tab.products")}
                </Link>
              </div>
            </div>
          </header>

          <div className="sticky top-[65px] z-40 bg-background-light dark:bg-background-dark py-4 -mx-4 px-4 md:mx-0 md:px-0 mb-6 transition-all duration-200">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mask-linear-fade">
              <Link
                className={`flex h-10 shrink-0 items-center justify-center rounded-full px-6 transition-all active-press font-bold text-sm ${!subCategoryId
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "bg-gray-100 dark:bg-gray-800 text-text-sub dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                href={buildFilterHref()}
              >
                {t(lang, "category.filter.all")}
              </Link>
              {subcategoryTags.map((tag) => {
                const isActive = tag.id === subCategoryId;
                const meta = getCategoryMeta(tag.name);
                return (
                  <Link
                    key={tag.id}
                    className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-5 transition-all active-press font-bold text-sm ${isActive
                        ? "bg-primary text-white shadow-md shadow-primary/25"
                        : "bg-gray-100 dark:bg-gray-800 text-text-sub dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                    href={buildFilterHref(tag.id)}
                  >
                    {meta.icon && (
                      <span className={`material-symbols-outlined text-[18px] ${isActive ? "text-white" : ""}`}>
                        {meta.icon}
                      </span>
                    )}
                    <span>{tag.name}</span>
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
