export const runtime = 'edge';

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
import type { Category, PaginationInfo, Review, UserProfile } from "@/src/types";
import { buildPopularTopics } from "@/components/layout/PopularReviewsWidget";
import { Suspense } from "react";
import {
  CatalogHeroSkeleton,
  CatalogListSkeleton,
  CatalogSidebarSkeleton,
} from "@/components/catalog/CatalogSectionSkeletons";
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
  getCatalogPageDirect,
  getCategoriesDirect,
  getPopularReviewsDirect,
  getUserProfileDirect,
} from "@/src/lib/api-direct";
import { buildMetadata, toAbsoluteUrl } from "@/src/lib/seo";
import { allowMockFallback } from "@/src/lib/runtime";
import {
  localizePath,
  normalizeLanguage,
  type SupportedLanguage,
} from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";
import {
  catalogReviewCards,
  catalogPagination,
  catalogPopularTopics,
} from "@/data/mock/reviews";
import { catalogTopAuthors } from "@/data/mock/users";

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
      const categories = await getCategoriesDirect(lang);
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

function buildTopAuthors(
  reviews: Review[],
  profiles: UserProfile[],
  fallback: CatalogTopAuthor[],
  lang: string
): CatalogTopAuthor[] {
  const authors: CatalogTopAuthor[] = [];
  const seen = new Set<string>();
  const resolvedLang = normalizeLanguage(lang);
  const profileMap = new Map(
    profiles.map((profile) => [profile.username.toLowerCase(), profile])
  );

  for (const review of reviews) {
    const username = review.author.username;
    if (!username || seen.has(username)) {
      continue;
    }
    seen.add(username);

    const rankIndex = authors.length;
    const profile = profileMap.get(username.toLowerCase());
    const reviewCount = profile?.stats?.reviewCount ?? review.ratingCount ?? 0;
    const karmaValue =
      profile?.stats?.karma ??
      profile?.stats?.reputation ??
      review.votesUp ??
      0;

    authors.push({
      profile: {
        username,
        displayName:
          profile?.displayName ?? review.author.displayName ?? username,
      },
      avatarUrl:
        profile?.profilePicUrl ??
        review.author.profilePicUrl ??
        pickFrom(FALLBACK_AVATARS, rankIndex),
      avatarAlt: t(resolvedLang, "catalog.avatarAlt", { username }),
      avatarDataAlt: t(resolvedLang, "catalog.avatarDataAlt", { username }),
      rankLabel: `#${rankIndex + 1}`,
      rankClassName: TOP_AUTHOR_RANKS[rankIndex] ?? TOP_AUTHOR_RANKS[0],
      reviewsLabel: t(resolvedLang, "catalog.topAuthorReviews", {
        count: formatCompactNumber(reviewCount, resolvedLang),
      }),
      karmaLabel: t(resolvedLang, "catalog.topAuthorKarma", {
        count: formatCompactNumber(karmaValue, resolvedLang),
      }),
    });

    if (authors.length >= 3) {
      break;
    }
  }

  return authors.length > 0 ? authors : fallback;
}

type CatalogMainData = {
  cards: ReviewCardCatalogData[];
  pagination: PaginationInfo;
  categories: Category[];
  errorMessage: string | null;
};

async function getCatalogMainData({
  apiConfigured,
  page,
  pageSize,
  sort,
  categoryId,
  lang,
  categoriesPromise,
}: {
  apiConfigured: boolean;
  page: number;
  pageSize: number;
  sort: "latest" | "popular" | "rating";
  categoryId?: number;
  lang: SupportedLanguage;
  categoriesPromise: Promise<Category[]>;
}): Promise<CatalogMainData> {
  if (!apiConfigured) {
    return {
      cards: allowMockFallback ? catalogReviewCards : [],
      pagination: allowMockFallback
        ? catalogPagination
        : { page, pageSize, totalPages: 0, totalItems: 0 },
      categories: [],
      errorMessage: allowMockFallback
        ? null
        : t(lang, "catalog.error.apiNotConfigured"),
    };
  }

  try {
    const [catalogResult, categoryItems] = await Promise.all([
      getCatalogPageDirect(page, pageSize, sort, categoryId, lang),
      categoriesPromise.catch(() => []),
    ]);
    return {
      cards: buildCatalogCards(catalogResult.items, categoryItems, lang),
      pagination: catalogResult.pageInfo,
      categories: categoryItems,
      errorMessage: null,
    };
  } catch (error) {
    console.error("Failed to load catalog API data", error);
    return {
      cards: allowMockFallback ? catalogReviewCards : [],
      pagination: allowMockFallback
        ? catalogPagination
        : { page, pageSize, totalPages: 0, totalItems: 0 },
      categories: [],
      errorMessage: allowMockFallback ? null : t(lang, "catalog.error.loadFailed"),
    };
  }
}

type CatalogSidebarData = {
  popularTopics: CatalogPopularTopic[];
  topAuthors: CatalogTopAuthor[];
};

async function getCatalogSidebarData({
  apiConfigured,
  lang,
  categoriesPromise,
}: {
  apiConfigured: boolean;
  lang: SupportedLanguage;
  categoriesPromise: Promise<Category[]>;
}): Promise<CatalogSidebarData> {
  if (!apiConfigured) {
    return {
      popularTopics: allowMockFallback ? catalogPopularTopics : [],
      topAuthors: allowMockFallback ? catalogTopAuthors : [],
    };
  }

  try {
    const [popularReviews, categories] = await Promise.all([
      getPopularReviewsDirect(POPULAR_LIMIT, undefined, lang),
      categoriesPromise.catch(() => []),
    ]);
    const topAuthorUsernames = Array.from(
      new Set(
        popularReviews
          .map((review) => review.author.username)
          .filter((username): username is string => Boolean(username))
      )
    ).slice(0, 3);
    const profileResults = await Promise.allSettled(
      topAuthorUsernames.map((username) => getUserProfileDirect(username))
    );
    const topAuthorProfiles = profileResults
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter((profile): profile is UserProfile => Boolean(profile));

    return {
      popularTopics: buildPopularTopics(
        popularReviews,
        categories,
        lang,
        POPULAR_LIMIT
      ),
      topAuthors: buildTopAuthors(
        popularReviews,
        topAuthorProfiles,
        allowMockFallback ? catalogTopAuthors : [],
        lang
      ),
    };
  } catch (error) {
    console.error("Failed to load catalog sidebar data", error);
    return {
      popularTopics: allowMockFallback ? catalogPopularTopics : [],
      topAuthors: allowMockFallback ? catalogTopAuthors : [],
    };
  }
}

async function CatalogHeaderSection({
  dataPromise,
  lang,
  sort,
  categoryId,
}: {
  dataPromise: Promise<CatalogMainData>;
  lang: SupportedLanguage;
  sort: CatalogSortParam;
  categoryId?: number;
}) {
  const { categories, pagination, errorMessage } = await dataPromise;
  const categoryPills = buildCategoryPills(categories, lang);
  const totalReviews = pagination.totalItems ?? 0;
  const catalogSubtitle =
    totalReviews > 0
      ? t(lang, "catalog.subtitle.withCount", {
        count: formatCompactNumber(totalReviews, lang),
      })
      : t(lang, "catalog.subtitle.empty");
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

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      {errorMessage ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
          {errorMessage}
        </div>
      ) : null}
      <div className="mb-12 relative overflow-hidden">
        <nav aria-label="Breadcrumb" className="flex mb-8 relative z-10">
          <ol className="flex items-center gap-2 text-sm text-text-sub dark:text-gray-400 font-medium">
            <li>
              <Link
                className="hover:text-primary transition-colors flex items-center"
                href={localizePath("/", lang)}
              >
                {t(lang, "catalog.breadcrumb.home")}
              </Link>
            </li>
            <li>
              <span className="text-gray-300 dark:text-gray-600">/</span>
            </li>
            <li className="text-text-main dark:text-gray-100 font-bold">
              {t(lang, "catalog.breadcrumb.catalog")}
            </li>
          </ol>
        </nav>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10">
          <div className="max-w-3xl">
            <h2 className="text-4xl md:text-6xl font-black tracking-tight text-text-main dark:text-white mb-6 leading-tight">
              {t(lang, "catalog.heading")}
            </h2>
            <p className="text-lg md:text-xl text-text-sub dark:text-gray-400 leading-relaxed font-medium">
              {catalogSubtitle}
            </p>
          </div>
          <div className="w-full md:w-auto min-w-[220px]">
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
        </div>

        <div className="mt-8 pt-0 md:pt-4">
          <Suspense fallback={null}>
            <CatalogCategoryChips categoryId={categoryId} pills={categoryPills} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function CatalogListSection({
  dataPromise,
  lang,
  buildHref,
}: {
  dataPromise: Promise<CatalogMainData>;
  lang: SupportedLanguage;
  buildHref: (page: number) => string;
}) {
  const { cards, pagination } = await dataPromise;
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
    <>
      <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
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
    </>
  );
}

async function CatalogSidebarSection({
  dataPromise,
  lang,
}: {
  dataPromise: Promise<CatalogSidebarData>;
  lang: SupportedLanguage;
}) {
  const { popularTopics, topAuthors } = await dataPromise;
  return (
    <SidebarCatalog
      lang={lang}
      popularTopics={popularTopics}
      topAuthors={topAuthors}
    />
  );
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
  const categoriesPromise = apiConfigured
    ? getCategoriesDirect(lang)
    : Promise.resolve<Category[]>([]);
  const catalogMainDataPromise = getCatalogMainData({
    apiConfigured,
    page,
    pageSize,
    sort: apiSort,
    categoryId,
    lang,
    categoriesPromise,
  });
  const catalogSidebarDataPromise = getCatalogSidebarData({
    apiConfigured,
    lang,
    categoriesPromise,
  });
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
        <Suspense fallback={<CatalogHeroSkeleton />}>
          <CatalogHeaderSection
            dataPromise={catalogMainDataPromise}
            lang={lang}
            sort={sort}
            categoryId={categoryId}
          />
        </Suspense>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Suspense fallback={<CatalogListSkeleton />}>
            <CatalogListSection
              dataPromise={catalogMainDataPromise}
              lang={lang}
              buildHref={buildHref}
            />
          </Suspense>
          <Suspense fallback={<CatalogSidebarSkeleton />}>
            <CatalogSidebarSection
              dataPromise={catalogSidebarDataPromise}
              lang={lang}
            />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
