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
import { buildMetadata, toAbsoluteUrl } from "@/src/lib/seo";
import { allowMockFallback } from "@/src/lib/runtime";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";
import {
  catalogReviewCards,
  catalogPagination,
  catalogPopularTopics,
} from "@/data/mock/reviews";
import { catalogTopAuthors } from "@/data/mock/users";

export const runtime = "edge";
export const revalidate = 60;

const DEFAULT_PAGE_SIZE = 10;
const POPULAR_LIMIT = 4;
const DEFAULT_SORT = "latest" as const;
const SORT_OPTIONS = [
  { value: "latest", apiValue: "latest", labelKey: "catalog.sort.newest" },
  { value: "rating", apiValue: "rating", labelKey: "catalog.sort.highestRated" },
  { value: "popular", apiValue: "popular", labelKey: "catalog.sort.mostDiscussed" },
  { value: "trending", apiValue: "popular", labelKey: "catalog.sort.trending" },
] as const;
const SORT_PARAM_VALUES = new Set<CatalogSortParam>(
  SORT_OPTIONS.map((option) => option.value)
);

export async function generateMetadata(
  props: CatalogPageProps
): Promise<Metadata> {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const sort = parseSort(searchParams?.sort);
  const categoryId = parseOptionalNumber(searchParams?.categoryId);
  let categoryLabel: string | undefined;

  if (categoryId && process.env.NEXT_PUBLIC_API_BASE_URL) {
    try {
      const categories = await getCategories(lang);
      categoryLabel = getCategoryLabel(categories, categoryId);
    } catch {
      categoryLabel = undefined;
    }
  }

  const baseTitle = t(lang, "catalog.meta.title");
  const baseDescription = t(lang, "catalog.meta.description");
  const title = categoryLabel
    ? t(lang, "category.meta.titleWithLabel", { label: categoryLabel })
    : baseTitle;
  const description = categoryLabel
    ? t(lang, "category.meta.descriptionWithLabel", { label: categoryLabel })
    : baseDescription;
  const metadata = buildMetadata({
    title,
    description,
    path: "/catalog",
    lang,
    type: "website",
  });
  const isIndexable =
    page === 1 &&
    pageSize === DEFAULT_PAGE_SIZE &&
    sort === DEFAULT_SORT &&
    !categoryId;

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

function buildCategoryPills(categories: Category[], lang: string) {
  const resolvedLang = normalizeLanguage(lang);
  const topLevel = categories.filter((category) => category.parentId == null);

  const pills = [
    { label: t(resolvedLang, "catalog.categoryPill.all"), id: undefined, isAll: true },
    ...topLevel.map((category) => ({
      label: category.name,
      id: category.id,
      isAll: false,
    })),
  ];
  return pills;
}

function buildCatalogCards(
  reviews: Review[],
  categories: Category[],
  lang: string
): ReviewCardCatalogData[] {
  const resolvedLang = normalizeLanguage(lang);
  return reviews.map((review, index) => {
    const categoryLabel = getCategoryLabel(categories, review.categoryId);
    const categoryMeta = getCategoryMeta(categoryLabel);

    return {
      review,
      href: localizePath(`/content/${review.slug}`, lang),
      dateLabel: formatRelativeTime(review.createdAt, resolvedLang),
      ratingStars: buildRatingStars(review.ratingAvg),
      ratingValue: (review.ratingAvg ?? 0).toFixed(1),
      imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
      imageAlt: review.title,
      authorAvatarAlt: t(resolvedLang, "catalog.avatarAlt", {
        username: review.author.username,
      }),
      authorAvatarDataAlt: t(resolvedLang, "catalog.avatarDataAlt", {
        username: review.author.username,
      }),
      authorAvatarUrl:
        review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index),
      category: categoryMeta,
      viewsLabel: formatCompactNumber(review.views ?? 0, resolvedLang),
      likesLabel: formatCompactNumber(review.votesUp ?? 0, resolvedLang),
      showImageOverlay: Boolean(review.photoCount && review.photoCount > 1),
    };
  });
}

function buildPopularTopics(
  reviews: Review[],
  categories: Category[],
  lang: string
): CatalogPopularTopic[] {
  const resolvedLang = normalizeLanguage(lang);
  return reviews.map((review, index) => {
    const categoryLabel =
      getCategoryLabel(categories, review.categoryId) ??
      t(resolvedLang, "common.general");
    return {
      slug: review.slug,
      rankLabel: String(index + 1).padStart(2, "0"),
      title: review.title,
      metaLabel: t(resolvedLang, "catalog.popularTopicMeta", {
        category: categoryLabel,
        count: formatCompactNumber(review.ratingCount ?? 0, resolvedLang),
      }),
    };
  });
}

function buildTopAuthors(
  reviews: Review[],
  fallback: CatalogTopAuthor[],
  lang: string
): CatalogTopAuthor[] {
  const authors: CatalogTopAuthor[] = [];
  const seen = new Set<string>();
  const resolvedLang = normalizeLanguage(lang);

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
      avatarAlt: t(resolvedLang, "catalog.avatarAlt", { username }),
      avatarDataAlt: t(resolvedLang, "catalog.avatarDataAlt", { username }),
      rankLabel: `#${rankIndex + 1}`,
      rankClassName: TOP_AUTHOR_RANKS[rankIndex] ?? TOP_AUTHOR_RANKS[0],
      reviewsLabel: t(resolvedLang, "catalog.topAuthorReviews", {
        count: formatCompactNumber(review.ratingCount ?? 0, resolvedLang),
      }),
      karmaLabel: t(resolvedLang, "catalog.topAuthorKarma", {
        count: formatCompactNumber(review.votesUp ?? 0, resolvedLang),
      }),
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
      popularTopics = buildPopularTopics(popularReviews, categories, lang);
      topAuthors = buildTopAuthors(
        popularReviews,
        allowMockFallback ? catalogTopAuthors : [],
        lang
      );
    } catch (error) {
      console.error("Failed to load catalog API data", error);
      if (!allowMockFallback) {
        errorMessage = t(lang, "catalog.error.loadFailed");
      }
    }
  } else if (!allowMockFallback) {
    errorMessage = t(lang, "catalog.error.apiNotConfigured");
  }

  const categoryPills = buildCategoryPills(categories, lang);
  const totalReviews = pagination.totalItems ?? 0;
  const catalogSubtitle =
    totalReviews > 0
      ? t(lang, "catalog.subtitle.withCount", {
        count: formatCompactNumber(totalReviews, lang),
      })
      : t(lang, "catalog.subtitle.empty");
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
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: t(lang, "catalog.breadcrumb.home"),
        item: toAbsoluteUrl(localizePath("/", lang)),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t(lang, "catalog.breadcrumb.catalog"),
        item: toAbsoluteUrl(localizePath("/catalog", lang)),
      },
    ],
  };
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t(lang, "catalog.meta.title"),
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: cards.length,
    itemListElement: cards.map((card, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: toAbsoluteUrl(card.href),
    })),
  };

  return (
    <div
      className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-50 font-display min-h-screen flex flex-col"
      data-page="catalog-page"
    >
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbJsonLd)}
        </script>
        <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
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
                {t(lang, "catalog.breadcrumb.home")}
              </Link>
            </li>
            <li>
              <span className="mx-1">/</span>
            </li>
            <li className="font-medium text-slate-900 dark:text-slate-200">
              {t(lang, "catalog.breadcrumb.catalog")}
            </li>
          </ol>
        </nav>
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
                {t(lang, "catalog.heading")}
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                {catalogSubtitle}
              </p>
            </div>
            <Suspense fallback={null}>
              <CatalogSortSelect
                sort={sort}
                options={SORT_OPTIONS.map(({ labelKey, value }) => ({
                  label: t(lang, labelKey),
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
                title={t(lang, "catalog.empty.title")}
                description={t(lang, "catalog.empty.description")}
                ctaLabel={t(lang, "catalog.empty.cta")}
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
