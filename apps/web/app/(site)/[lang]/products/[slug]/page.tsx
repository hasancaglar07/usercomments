export const runtime = 'edge';

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import ProductCard from "@/components/cards/ProductCard";
import RatingHistogram from "@/components/product/RatingHistogram";
import {
  ReviewCardCategory,
  type ReviewCardCategoryData,
} from "@/components/cards/ReviewCard";
import { ReviewListCatalog } from "@/components/lists/ReviewList";
import CategorySortSelect from "@/components/catalog/CategorySortSelect";
import EmptyState from "@/components/ui/EmptyState";
import AdSquare from "@/components/ads/AdSquare";
import AdMultiplex from "@/components/ads/AdMultiplex";
import AdBillboard from "@/components/ads/AdBillboard";
import SeoContentCollapse from "@/components/product/SeoContentCollapse";

import { RatingStarsCatalog } from "@/components/ui/RatingStars";

import Breadcrumb, { type BreadcrumbItem } from "@/components/ui/Breadcrumb";
import type { Category, Product, Review } from "@/src/types";
import {
  getCategoryPageDirect,
  getCategoriesDirect,
  getProductsDirect,
  getProductBySlugDirect,
  getProductReviewsDirect,
} from "@/src/lib/api-direct";
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

const RELATED_FETCH_LIMIT = 8;
const RELATED_PRODUCTS_LIMIT = 3;
const RELATED_REVIEWS_LIMIT = 3;

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

function buildRelatedReviewCards(
  reviews: Review[],
  categories: Category[],
  lang: string
): ReviewCardCategoryData[] {
  const resolvedLang = normalizeLanguage(lang);
  return reviews.map((review, index) => {
    const subCategoryLabel = getCategoryLabel(categories, review.subCategoryId);
    const categoryLabel = getCategoryLabel(categories, review.categoryId);

    return {
      review,
      href: localizePath(`/content/${review.slug}`, lang),
      dateLabel: formatRelativeTime(review.createdAt, resolvedLang),
      ratingStars: buildRatingStars(review.ratingAvg),
      imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
      imageAlt: review.title,
      avatarUrl:
        review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index),
      avatarAlt: t(resolvedLang, "category.card.avatarAlt", {
        username: review.author.username,
      }),
      tagLabel:
        subCategoryLabel ??
        categoryLabel ??
        t(resolvedLang, "common.general"),
      likesLabel: formatCompactNumber(review.votesUp ?? 0, resolvedLang),
      commentsLabel: formatCompactNumber(review.commentCount ?? 0, resolvedLang),
    };
  });
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  const product = await getProductBySlugDirect(params.slug, lang).catch(() => null);

  if (!product) {
    return buildMetadata({
      title: t(lang, "productDetail.meta.notFoundTitle"),
      description: t(lang, "productDetail.meta.notFoundDescription"),
      path: `/products/${params.slug}`,
      lang,
      robots: {
        index: false,
        follow: true,
      },
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

  const reviewCount = product.stats?.reviewCount ?? 0;
  const shouldIndex = reviewCount > 0;

  let ogImage = product.images?.[0]?.url;

  // Fallback: If no official product image, try to find a review image
  if (!ogImage && reviewCount > 0) {
    try {
      const reviews = await getProductReviewsDirect(product.id, 1, 5, "popular", resolvedLang as SupportedLanguage);
      const reviewWithImage = reviews.items.find(
        (r) => r.photoUrls && r.photoUrls.length > 0
      );
      if (reviewWithImage?.photoUrls?.[0]) {
        ogImage = reviewWithImage.photoUrls[0];
      }
    } catch (error) {
      console.error("Failed to fetch fallback review image for SEO:", error);
    }
  }

  return buildMetadata({
    title: t(lang, "productDetail.meta.titleTemplate", { name: product.name }),
    description:
      product.description ??
      t(lang, "productDetail.meta.descriptionFallback"),
    path: `/products/${product.slug}`,
    lang: resolvedLang as SupportedLanguage,
    type: "website",
    image: ogImage,
    keywords: [product.name, "Reviews", "Ratings", "UserReview"],
    languagePaths,
    robots: shouldIndex
      ? undefined
      : {
        index: false,
        follow: true,
      },
  });
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const sort = parseSort(searchParams?.sort);

  const product = await getProductBySlugDirect(params.slug, lang).catch(() => null);
  if (!product) {
    notFound();
  }

  if (lang !== DEFAULT_LANGUAGE && product.translationLang && product.translationLang !== lang) {
    const fallbackSlug =
      product.translations?.find(
        (translation) => translation.lang === DEFAULT_LANGUAGE
      )?.slug ?? product.slug;
    redirect(localizePath(`/products/${fallbackSlug}`, DEFAULT_LANGUAGE));
  }

  const primaryCategoryId = product.categoryIds?.[0];
  const relatedProductsPromise = primaryCategoryId
    ? getProductsDirect(1, RELATED_FETCH_LIMIT, "popular", primaryCategoryId, lang).catch(
      () => null
    )
    : Promise.resolve(null);
  const relatedReviewsPromise = primaryCategoryId
    ? getCategoryPageDirect(
      primaryCategoryId,
      1,
      RELATED_FETCH_LIMIT,
      "popular",
      undefined,
      lang
    ).catch(() => null)
    : Promise.resolve(null);

  const [categories, reviewsResult, relatedProductsResult, relatedReviewsResult] =
    await Promise.all([
      getCategoriesDirect(lang),
      getProductReviewsDirect(product.id, page, pageSize, sort, lang),
      relatedProductsPromise,
      relatedReviewsPromise,
    ]);

  const cards = buildReviewCards(reviewsResult.items, categories, lang);
  const categoryMap = new Map<number, Category>();
  categories.forEach((category) => categoryMap.set(category.id, category));
  const relatedProducts = (relatedProductsResult?.items ?? [])
    .filter((item) => item.id !== product.id)
    .slice(0, RELATED_PRODUCTS_LIMIT);
  const relatedReviews = (relatedReviewsResult?.items ?? [])
    .filter((item) => item.productId !== product.id)
    .slice(0, RELATED_REVIEWS_LIMIT);
  const relatedReviewCards = buildRelatedReviewCards(
    relatedReviews,
    categories,
    lang
  );
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
  const primaryCategoryLabel =
    categoryLabels[0] ?? t(lang, "common.general");
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
  const productImageUrls = product.images?.length
    ? product.images.map((image) => toAbsoluteUrl(image.url))
    : [toAbsoluteUrl(DEFAULT_REVIEW_IMAGE)];
  const productImage = getOptimizedImageUrl(
    product.images?.[0]?.url ?? DEFAULT_REVIEW_IMAGE,
    600
  );
  const reviewHref = `${localizePath("/node/add/review", lang)}?productSlug=${encodeURIComponent(
    product.slug
  )}`;
  const productUrl = toAbsoluteUrl(localizePath(`/products/${product.slug}`, lang));
  const relatedProductsHref = primaryCategoryId
    ? localizePath(`/catalog/list/${primaryCategoryId}`, lang)
    : localizePath("/products", lang);
  const relatedReviewsHref = primaryCategoryId
    ? localizePath(`/catalog/reviews/${primaryCategoryId}`, lang)
    : localizePath("/catalog", lang);
  const resolveProductCategoryLabel = (item: Product) => {
    const firstCategoryId = item.categoryIds?.[0];
    return firstCategoryId ? categoryMap.get(firstCategoryId)?.name : undefined;
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
        name: t(lang, "products.meta.title"),
        item: toAbsoluteUrl(localizePath("/products", lang)),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: primaryCategoryLabel,
        item: toAbsoluteUrl(localizePath(`/catalog/reviews/${primaryCategoryId}`, lang)),
      },
      {
        "@type": "ListItem",
        position: 4,
        name: product.name,
        item: productUrl,
      },
    ],
  };
  // Build review snippets for schema (first 3 reviews with ratings)
  const reviewSchemaItems = reviewsResult.items
    .filter((r) => r.ratingAvg && r.ratingAvg > 0)
    .slice(0, 3)
    .map((r) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: r.author.displayName || r.author.username,
        url: toAbsoluteUrl(localizePath(`/users/${r.author.username}`, lang)),
      },
      datePublished: r.createdAt,
      reviewBody: r.excerpt ?? r.title,
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.ratingAvg,
        bestRating: 5,
        worstRating: 1,
      },
      positiveNotes: r.pros?.length
        ? {
          "@type": "ItemList",
          itemListElement: r.pros.map((pro, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: pro,
          })),
        }
        : undefined,
      negativeNotes: r.cons?.length
        ? {
          "@type": "ItemList",
          itemListElement: r.cons.map((con, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: con,
          })),
        }
        : undefined,
    }));

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.name,
    description: product.description ?? t(lang, "productDetail.descriptionFallback"),
    image: productImageUrls,
    category: categoryNames,
    sku: String(product.id),
    mpn: String(product.id),
    inLanguage: lang,
    datePublished: product.createdAt ?? undefined,
    dateModified: product.updatedAt ?? undefined,
    brand: product.brand?.name
      ? {
        "@type": "Brand",
        name: product.brand.name,
      }
      : undefined,
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "0",
          currency: "USD",
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "US",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 1,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: 5,
            unitCode: "DAY",
          },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "US",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 30,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
      priceCurrency: "USD",
      price: "0",
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      url: productUrl,
      itemCondition: "https://schema.org/NewCondition",
    },
    aggregateRating:
      ratingCount > 0
        ? {
          "@type": "AggregateRating",
          ratingValue: ratingValue ?? ratingAvg,
          ratingCount,
          reviewCount,
          bestRating: "5",
          worstRating: "1",
        }
        : undefined,
    review: reviewSchemaItems.length > 0 ? reviewSchemaItems : undefined,
    url: productUrl,
  };

  // NEW: Aggregate Pros/Cons from the first page of reviews to simulating "Top Pros/Cons"
  // NEW: Aggregate Pros/Cons from the first page of reviews to simulating "Top Pros/Cons"
  const hasCyrillic = (text: string) => /[\u0400-\u04FF]/.test(text);
  const shouldFilterCyrillic = (lang as string) !== "ru";

  const aggregatedPros = Array.from(new Set(reviewsResult.items.flatMap(r => r.pros || [])))
    .filter(text => !shouldFilterCyrillic || !hasCyrillic(text))
    .slice(0, 4);

  const aggregatedCons = Array.from(new Set(reviewsResult.items.flatMap(r => r.cons || [])))
    .filter(text => !shouldFilterCyrillic || !hasCyrillic(text))
    .slice(0, 4);

  // NEW: Generate Synthetic FAQs for SEO and User Experience
  // PRIORITIZE AGGREGATED FAQs from reviews if available
  const extendedFaq = (product as { extendedFaq?: Array<{ question: string; answer: string }> })
    .extendedFaq;

  const faqItems: Array<{ question: string; answer: string }> = [];

  // Always include the "What Is" question as it is good for SEO
  faqItems.push({
    question: t(lang, "productDetail.faq.whatIs", { productName: product.name }),
    answer: product.description || t(lang, "productDetail.descriptionFallback"),
  });

  if (extendedFaq && extendedFaq.length > 0) {
    // Append aggregated FAQs
    faqItems.push(...extendedFaq);
  } else {
    // Fallback: Add the recommendation question only if we don't have better FAQs
    faqItems.push({
      question: t(lang, "productDetail.faq.isRecommended", { productName: product.name }),
      answer: ratingCount > 0
        ? t(lang, "productDetail.faq.ratingAnswer", {
          rating: ratingAvg.toFixed(1),
          count: formatNumber(ratingCount, lang)
        })
        : t(lang, "productDetail.faq.noRatingsYet"),
    });
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  };

  return (
    <main className="flex-1 flex justify-center py-10 px-4 sm:px-6 bg-background-light dark:bg-background-dark">
      <div className="layout-content-container flex flex-col max-w-6xl w-full gap-8">
        <AdBillboard />
        <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script>

        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm">
          <div className="grid gap-8 md:grid-cols-[260px_1fr]">
            {/* Left Column: Image */}
            <div className="flex flex-col gap-4">
              <div className="aspect-square w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 overflow-hidden relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productImage}
                  alt={t(lang, "productDetail.meta.titleTemplate", { name: product.name })}
                  className="w-full h-full object-contain p-4"
                  decoding="async"
                  fetchPriority="high"
                  loading="eager"
                />
              </div>
              {/* Quick stats for mobile could go here if needed */}
            </div>

            {/* Right Column: Info & Stats */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {categoryLabels.map((label) => (
                  <Link
                    key={label}
                    href={localizePath(`/catalog/reviews/${primaryCategoryId}`, lang)}
                    className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight">
                  {product.name}
                </h1>
                <p className="text-base text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                  {product.description ?? t(lang, "productDetail.descriptionFallback")}
                </p>
              </div>

              <AdSquare />
              {/* Rating Block: Histogram & Big Numbers */}

              <div className="flex flex-col sm:flex-row gap-8 py-6 border-y border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-6 sm:border-r sm:border-slate-100 sm:dark:border-slate-800 sm:pr-8">
                  <div className="text-center">
                    <div className="text-5xl font-black text-slate-900 dark:text-white">
                      {ratingAvg > 0 ? ratingAvg.toFixed(1) : "0.0"}
                    </div>
                    <div className="mt-1">
                      <RatingStarsCatalog
                        stars={buildRatingStars(ratingAvg)}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {t(lang, "productDetail.rating.countLabel", {
                        count: formatNumber(ratingCount, lang),
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex-1">
                  <RatingHistogram ratingAvg={ratingAvg} ratingCount={ratingCount} />
                </div>

                <div className="hidden sm:flex flex-col justify-center pl-4 border-l border-slate-100 dark:border-slate-800">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {recommendRate !== null ? `${recommendRate}%` : "—"}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">
                      {t(lang, "productDetail.recommend.label")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pros & Cons Summary (Simulated) */}
              {(aggregatedPros.length > 0 || aggregatedCons.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {aggregatedPros.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4">
                      <h3 className="flex items-center gap-2 font-bold text-green-800 dark:text-green-300 mb-2 text-sm">
                        <span className="material-symbols-outlined text-lg">add_circle</span>
                        {t(lang, "reviewDetail.pros")}
                      </h3>
                      <ul className="space-y-1">
                        {aggregatedPros.map((pro, i) => (
                          <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                            <span className="text-green-500 font-bold">•</span>
                            {pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aggregatedCons.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4">
                      <h3 className="flex items-center gap-2 font-bold text-red-800 dark:text-red-300 mb-2 text-sm">
                        <span className="material-symbols-outlined text-lg">do_not_disturb_on</span>
                        {t(lang, "reviewDetail.cons")}
                      </h3>
                      <ul className="space-y-1">
                        {aggregatedCons.map((con, i) => (
                          <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                            <span className="text-red-500 font-bold">•</span>
                            {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-xl bg-primary text-white text-base font-bold px-8 py-3 hover:bg-primary-dark shadow-sm shadow-primary/30 transition-all hover:scale-105 active:scale-95"
                  href={reviewHref}
                >
                  <span className="material-symbols-outlined mr-2">rate_review</span>
                  {t(lang, "productDetail.cta.writeReview")}
                </Link>
                <Link
                  className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-base font-bold px-6 py-3 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary transition-colors"
                  href={localizePath("/products", lang)}
                >
                  {t(lang, "productDetail.cta.browseAll")}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
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

        {faqItems.length > 0 && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              {t(lang, "productDetail.faq.title")}
            </h2>
            <div className="space-y-6">
              {faqItems.map((item, index) => (
                <div key={index} className="border-b border-slate-100 dark:border-slate-800 last:border-0 pb-6 last:pb-0">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {item.question}
                  </h3>
                  <div className="text-slate-600 dark:text-slate-400 prose dark:prose-invert max-w-none text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: item.answer }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <AdMultiplex />
        {relatedProducts.length > 0 || relatedReviewCards.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {t(lang, "productDetail.related.title")}
                </h2>
              </div>
            </div>
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              {relatedProducts.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {t(lang, "productDetail.related.productsTitle")}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t(lang, "productDetail.related.productsSubtitle", {
                          category: primaryCategoryLabel,
                        })}
                      </p>
                    </div>
                    <Link
                      href={relatedProductsHref}
                      className="text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
                    >
                      {t(lang, "productDetail.cta.browseAll")}
                    </Link>
                  </div>
                  <div className="flex flex-col gap-4">
                    {relatedProducts.map((item) => (
                      <ProductCard
                        key={item.id}
                        product={item}
                        lang={lang}
                        categoryLabel={resolveProductCategoryLabel(item)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {relatedReviewCards.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {t(lang, "productDetail.related.reviewsTitle")}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t(lang, "productDetail.related.reviewsSubtitle", {
                          category: primaryCategoryLabel,
                        })}
                      </p>
                    </div>
                    <Link
                      href={relatedReviewsHref}
                      className="text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
                    >
                      {t(lang, "reviewDetail.related.viewAll")}
                    </Link>
                  </div>
                  <div className="flex flex-col gap-4">
                    {relatedReviewCards.map((card) => (
                      <ReviewCardCategory key={card.review.id} {...card} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
            </section>
        ) : null}

      <SeoContentCollapse
        contentHtml={product.seoContentHtml ?? ""}
        lang={lang}
        className="mt-8"
      />
    </div>

    </main >
  );
}
