import Link from "next/link";
import { ReviewListCategory } from "@/components/lists/ReviewList";
import type { Metadata } from "next";
import { SidebarCategory } from "@/components/layout/Sidebar";
import type {
  CategoryBestItem,
  CategoryTopAuthor,
} from "@/components/layout/Sidebar";
import type { ReviewCardCategoryData } from "@/components/cards/ReviewCard";
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

const SORT_OPTIONS = new Set(["latest", "popular", "rating"]);

export async function generateMetadata(
  props: CategoryPageProps
): Promise<Metadata> {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
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

  return buildMetadata({
    title,
    description: categoryLabel
      ? t(lang, "category.meta.descriptionWithLabel", { label: categoryLabel })
      : t(lang, "category.meta.descriptionDefault"),
    path: `/catalog/reviews/${params.id}`,
    lang,
    type: "website",
  });
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
      const [categoryResult, categories, subcategories] = await Promise.all([
        getCategoryPage(categoryId, page, pageSize, sort, subCategoryId, lang),
        getCategories(lang),
        getSubcategories(categoryId, lang),
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
          <div className="flex flex-wrap gap-2 pb-4">
            <Link
              className="text-[#4c739a] text-sm font-medium hover:text-primary hover:underline"
              href={localizePath("/", lang)}
            >
              {t(lang, "category.breadcrumb.home")}
            </Link>
            <span className="text-[#4c739a] text-sm font-medium">/</span>
            <Link
              className="text-[#4c739a] text-sm font-medium hover:text-primary hover:underline"
              href={localizePath("/catalog", lang)}
            >
              {t(lang, "category.breadcrumb.reviews")}
            </Link>
            <span className="text-[#4c739a] text-sm font-medium">/</span>
            <span className="text-[#0d141b] text-sm font-medium">
              {categoryLabel}
            </span>
          </div>
          {errorMessage ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
              {errorMessage}
            </div>
          ) : null}
          <div className="flex flex-col gap-3 pb-6 border-b border-[#e7edf3]">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="flex h-9 items-center justify-center rounded-full bg-[#0d141b] text-white px-5 text-sm font-bold"
                href={localizePath(`/catalog/reviews/${categoryId}`, lang)}
              >
                {t(lang, "category.tab.reviews")}
              </Link>
              <Link
                className="flex h-9 items-center justify-center rounded-full bg-white border border-[#e7edf3] px-5 text-sm font-bold text-[#0d141b] hover:border-primary hover:text-primary"
                href={localizePath(`/catalog/list/${categoryId}`, lang)}
              >
                {t(lang, "category.tab.products")}
              </Link>
            </div>
            <h1 className="text-[#0d141b] text-4xl font-black leading-tight tracking-[-0.033em]">
              {categoryLabel}
            </h1>
            <p className="text-[#4c739a] text-lg font-normal max-w-3xl">
              {categoryDescription}
            </p>
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
        </main>
      </div>
    </div>
  );
}
