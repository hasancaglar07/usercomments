import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ReviewListCatalog } from "@/components/lists/ReviewList";
import CategorySortSelect from "@/components/catalog/CategorySortSelect";
import EmptyState from "@/components/ui/EmptyState";
import { RatingStarsCatalog } from "@/components/ui/RatingStars";
import type { Category, Review } from "@/src/types";
import {
  getCategories,
  getProductBySlug,
  getProductReviews,
} from "@/src/lib/api";
import {
  buildRatingStars,
  DEFAULT_REVIEW_IMAGE,
  FALLBACK_AVATARS,
  FALLBACK_REVIEW_IMAGES,
  formatCompactNumber,
  formatNumber,
  formatRelativeTime,
  getCategoryLabel,
  getCategoryMeta,
  pickFrom,
} from "@/src/lib/review-utils";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";
import { buildMetadata, toAbsoluteUrl } from "@/src/lib/seo";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  localizePath,
  normalizeLanguage,
  type SupportedLanguage,
} from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

export const revalidate = 300;

const DEFAULT_PAGE_SIZE = 8;

const SORT_OPTIONS = new Set(["latest", "popular", "rating"]);

type SortValue = "latest" | "popular" | "rating";

type PageProps = {
  params: Promise<{ lang: string; slug: string }>;
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    sort?: string;
  }>;
};

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseSort(value?: string): SortValue {
  const normalized = value?.toLowerCase();
  if (normalized && SORT_OPTIONS.has(normalized)) {
    return normalized as SortValue;
  }
  return "latest";
}

function buildReviewCards(reviews: Review[], categories: Category[], lang: string) {
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
      authorAvatarUrl: review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index),
      category: categoryMeta,
      viewsLabel: formatCompactNumber(review.views ?? 0, resolvedLang),
      likesLabel: formatCompactNumber(review.votesUp ?? 0, resolvedLang),
      showImageOverlay: Boolean(review.photoCount && review.photoCount > 1),
    };
  });
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  const product = await getProductBySlug(params.slug, lang).catch(() => null);

  if (!product) {
    return buildMetadata({
      title: t(lang, "productDetail.meta.notFoundTitle"),
      description: t(lang, "productDetail.meta.notFoundDescription"),
      path: `/products/${params.slug}`,
      lang,
    });
  }

  const languagePaths = product.translations
    ? Object.fromEntries(
        product.translations
          .filter((translation) => isSupportedLanguage(translation.lang))
          .map((translation) => [translation.lang, `/products/${translation.slug}`])
      )
    : undefined;
  const resolvedLang =
    product.translationLang && product.translationLang !== lang
      ? product.translationLang
      : lang;

  return buildMetadata({
    title: product.name,
    description:
      product.description ??
      t(lang, "productDetail.meta.descriptionFallback"),
    path: `/products/${product.slug}`,
    lang: resolvedLang as SupportedLanguage,
    type: "website",
    image: product.images?.[0]?.url,
    languagePaths,
  });
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const sort = parseSort(searchParams?.sort);

  const product = await getProductBySlug(params.slug, lang).catch(() => null);
  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">
          {t(lang, "productDetail.notFound.title")}
        </h1>
        <p className="text-slate-600 mb-6">
          {t(lang, "productDetail.notFound.description")}
        </p>
        <Link
          href={localizePath("/products", lang)}
          className="bg-primary text-white px-6 py-2 rounded-lg font-bold"
        >
          {t(lang, "productDetail.notFound.back")}
        </Link>
      </div>
    );
  }

  if (lang !== DEFAULT_LANGUAGE && product.translationLang && product.translationLang !== lang) {
    const fallbackSlug =
      product.translations?.find(
        (translation) => translation.lang === DEFAULT_LANGUAGE
      )?.slug ?? product.slug;
    redirect(localizePath(`/products/${fallbackSlug}`, DEFAULT_LANGUAGE));
  }

  const [categories, reviewsResult] = await Promise.all([
    getCategories(lang),
    getProductReviews(product.id, page, pageSize, sort, lang),
  ]);

  const cards = buildReviewCards(reviewsResult.items, categories, lang);
  const basePath = localizePath(`/products/${product.slug}`, lang);
  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      params.set("pageSize", String(pageSize));
    }
    if (sort !== "latest") {
      params.set("sort", sort);
    }
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const categoryLabels = (product.categoryIds ?? [])
    .map((id) => getCategoryLabel(categories, id))
    .filter((label): label is string => Boolean(label));
  const ratingAvg = product.stats?.ratingAvg ?? 0;
  const ratingCount = product.stats?.ratingCount ?? product.stats?.reviewCount ?? 0;
  const reviewCount = product.stats?.reviewCount ?? 0;
  const ratingValue = ratingCount > 0 ? Number(ratingAvg.toFixed(1)) : undefined;
  const recommendUp = product.stats?.recommendUp ?? 0;
  const recommendDown = product.stats?.recommendDown ?? 0;
  const recommendTotal = recommendUp + recommendDown;
  const recommendRate =
    recommendTotal > 0 ? Math.round((recommendUp / recommendTotal) * 100) : null;
  const categoryNames = categoryLabels.length > 0 ? categoryLabels : undefined;
  const productImageUrls = product.images?.map((image) => toAbsoluteUrl(image.url));
  const productImage = getOptimizedImageUrl(
    product.images?.[0]?.url ?? DEFAULT_REVIEW_IMAGE,
    900
  );
  const reviewHref = `${localizePath("/node/add/review", lang)}?productSlug=${encodeURIComponent(
    product.slug
  )}`;
  const productUrl = toAbsoluteUrl(localizePath(`/products/${product.slug}`, lang));
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
        name: t(lang, "products.meta.title"),
        item: toAbsoluteUrl(localizePath("/products", lang)),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: productUrl,
      },
    ],
  };
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.name,
    description: product.description ?? undefined,
    image: productImageUrls,
    category: categoryNames,
    inLanguage: lang,
    datePublished: product.createdAt ?? undefined,
    dateModified: product.updatedAt ?? undefined,
    brand: product.brand?.name
      ? {
          "@type": "Brand",
          name: product.brand.name,
        }
      : undefined,
    aggregateRating:
      ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: ratingValue ?? ratingAvg,
            ratingCount,
            reviewCount,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    url: productUrl,
  };

  return (
    <main className="flex-1 flex justify-center py-10 px-4 sm:px-6 bg-background-light dark:bg-background-dark">
      <div className="layout-content-container flex flex-col max-w-6xl w-full gap-8">
        <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbJsonLd)}
        </script>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm">
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div
              className="aspect-square w-full rounded-xl bg-slate-100 dark:bg-slate-800 bg-cover bg-center"
              style={{ backgroundImage: `url(${productImage})` }}
            />
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {categoryLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-semibold text-slate-600 dark:text-slate-300"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white">
                  {product.name}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  {product.description ??
                    t(lang, "productDetail.descriptionFallback")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <RatingStarsCatalog
                    stars={buildRatingStars(ratingAvg)}
                    valueText={
                      ratingAvg > 0
                        ? ratingAvg.toFixed(1)
                        : t(lang, "productDetail.rating.none")
                    }
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t(lang, "productDetail.rating.countLabel", {
                      count: formatNumber(ratingCount, lang),
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatNumber(reviewCount, lang)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t(lang, "productDetail.review.countLabel")}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {recommendRate !== null ? `${recommendRate}%` : "—"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t(lang, "productDetail.recommend.label")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  className="inline-flex items-center justify-center rounded-lg bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary-dark"
                  href={reviewHref}
                >
                  {t(lang, "productDetail.cta.writeReview")}
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold px-4 py-2 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary"
                  href={localizePath("/products", lang)}
                >
                  {t(lang, "productDetail.cta.browseAll")}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t(lang, "productDetail.community.title")}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t(lang, "productDetail.community.subtitle", {
                count: formatCompactNumber(
                  reviewsResult.pageInfo.totalItems ?? cards.length,
                  lang
                ),
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>{t(lang, "productDetail.sortBy")}</span>
            <Suspense fallback={null}>
              <CategorySortSelect sort={sort} />
            </Suspense>
          </div>
        </div>

        {cards.length > 0 ? (
          <ReviewListCatalog
            cards={cards}
            pagination={reviewsResult.pageInfo}
            buildHref={buildHref}
          />
        ) : (
          <EmptyState
            title={t(lang, "productDetail.empty.title")}
            description={t(lang, "productDetail.empty.description")}
            ctaLabel={t(lang, "productDetail.empty.cta")}
            authenticatedHref={`/node/add/review?productSlug=${encodeURIComponent(
              product.slug
            )}`}
          />
        )}
      </div>
    </main>
  );
}
