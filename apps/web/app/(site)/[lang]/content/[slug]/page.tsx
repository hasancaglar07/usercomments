export const runtime = 'edge';

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReviewDetailClient, {
  ReviewCommentForm,
  ReviewHelpfulButton,
} from "@/components/reviews/ReviewDetailClient";
import type { Metadata } from "next";
import { Suspense } from "react";
import type { Review, Comment, Category, Product } from "@/src/types";
import {
  getReviewBySlugDirect,
  getReviewCommentsDirect,
  getCategoriesDirect,
  getProductBySlugDirect,
  getCategoryPageDirect
} from "@/src/lib/api-direct";
import TableOfContents from "@/components/content/TableOfContents";
import {
  DEFAULT_AVATAR,

  DEFAULT_REVIEW_IMAGE,
  FALLBACK_AVATARS,
  FALLBACK_REVIEW_IMAGES,
  buildRatingStars,
  formatCompactNumber,
  formatNumber,
  formatRelativeTime,
  getCategoryLabel,
  pickFrom,
} from "@/src/lib/review-utils";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";
import { buildMetadata, toAbsoluteUrl } from "@/src/lib/seo";
import { allowMockFallback } from "@/src/lib/runtime";
import { homepageReviewCards } from "@/data/mock/reviews";
import { RatingStarsCatalog } from "@/components/ui/RatingStars";
import {
  ReviewCardCategory,
  type ReviewCardCategoryData,
} from "@/components/cards/ReviewCard";
import {
  ReviewCommentsSkeleton,
  ReviewRelatedSkeleton,
} from "@/components/content/ReviewDetailSectionSkeletons";
import AdSquare from "@/components/ads/AdSquare";
import AdMultiplex from "@/components/ads/AdMultiplex";
import AdVertical from "@/components/ads/AdVertical";


import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  localizePath,
  normalizeLanguage,
  type SupportedLanguage,
} from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

export const revalidate = 120;

const RELATED_FETCH_LIMIT = 6;
const RELATED_LIMIT = 3;

type PageProps = {
  params: Promise<{ lang: string; slug: string }>;
};

const mockReviewDetail = homepageReviewCards[0].review;
const mockComments: Comment[] = [];


export async function generateMetadata(
  props: PageProps
): Promise<Metadata> {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  const review = await getReviewBySlugDirect(params.slug, lang).catch(() => null);
  if (!review) {
    return buildMetadata({
      title: t(lang, "reviewDetail.meta.notFoundTitle"),
      description: t(lang, "reviewDetail.meta.notFoundDescription"),
      path: `/content/${params.slug}`,
      lang,
      robots: {
        index: false,
        follow: true,
      },
    });
  }

  const languagePaths = review.translations
    ? Object.fromEntries(
      review.translations
        .filter((translation) => isSupportedLanguage(translation.lang))
        .map((translation) => [translation.lang, `/content/${translation.slug}`])
    )
    : undefined;
  const resolvedLang =
    review.translationLang && review.translationLang !== lang
      ? review.translationLang
      : lang;
  const suffix = t(lang, "reviewDetail.meta.titleSuffix");
  let title = review.metaTitle ?? review.title;
  if (!review.metaTitle && !title.toLowerCase().endsWith(suffix.toLowerCase())) {
    title = `${title} ${suffix}`;
  }
  const description =
    review.metaDescription ??
    review.excerpt ??
    t(lang, "reviewDetail.meta.descriptionFallback");

  return buildMetadata({
    title,
    description,
    path: `/content/${review.slug}`,
    lang: resolvedLang as SupportedLanguage,
    type: "article",
    image: review.photoUrls?.[0],
    keywords: [review.title, "Review", "UserReview"],
    languagePaths,
  });
}

type ContentBlock =
  | { type: "p"; content: string }
  | { type: "h2"; content: string; id: string }
  | { type: "h3"; content: string; id: string };

type ReviewContent = {
  blocks: ContentBlock[];
  paragraphs: string[]; // Keep for backward compatibility if needed, or derived
  pros: string[];
  cons: string[];
};

function parseReviewContent(
  contentText: string | null | undefined,
  fallbackText: string | null | undefined
): ReviewContent {
  const baseText =
    contentText && contentText.trim().length > 0
      ? contentText
      : fallbackText ?? "";

  // Basic HTML tag stripping but try to preserve header semantics if possible
  // For now, we assume the input might contain Markdown headers ## or ###
  let normalized = baseText.replace(/\r\n/g, "\n").trim();

  // Should we convert HTML h2/h3 to Markdown ## before stripping?
  normalized = normalized
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n\n## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n\n### $1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .trim();

  if (!normalized) {
    return { blocks: [], paragraphs: [], pros: [], cons: [] };
  }

  const sections = normalized
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  const blocks: ContentBlock[] = [];
  const paragraphs: string[] = []; // Legacy support
  const pros: string[] = [];
  const cons: string[] = [];

  let headerCount = 0;

  sections.forEach((section) => {
    const lines = section
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    // Check for Pros/Cons lists
    const heading = lines[0].replace(/:$/, "").toLowerCase();
    if (heading === "pros" || heading === "cons") {
      const items = lines
        .slice(1)
        .map((line) => line.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean);
      if (heading === "pros") {
        pros.push(...items);
      } else {
        cons.push(...items);
      }
      return;
    }

    // Check for Markdown headers
    const firstLine = lines[0];
    if (firstLine.startsWith("### ")) {
      const text = firstLine.substring(4).trim();
      const id = `section-${headerCount++}`;
      blocks.push({ type: "h3", content: text, id });
      // If there are more lines in this section, they are a paragraph following the header
      if (lines.length > 1) {
        const pContent = lines.slice(1).join("\n");
        blocks.push({ type: "p", content: pContent });
        paragraphs.push(pContent);
      }
      return;
    }

    if (firstLine.startsWith("## ")) {
      const text = firstLine.substring(3).trim();
      const id = `section-${headerCount++}`;
      blocks.push({ type: "h2", content: text, id });
      if (lines.length > 1) {
        const pContent = lines.slice(1).join("\n");
        blocks.push({ type: "p", content: pContent });
        paragraphs.push(pContent);
      }
      return;
    }

    // Default paragraph
    const pContent = lines.join("\n");
    blocks.push({ type: "p", content: pContent });
    paragraphs.push(pContent);
  });

  return { blocks, paragraphs, pros, cons };
}

function buildRelatedCards(
  reviews: Review[],
  categories: Category[],
  lang: string
): ReviewCardCategoryData[] {
  const resolvedLang = normalizeLanguage(lang);
  return reviews.map((related, index) => {
    const subCategoryLabel = getCategoryLabel(categories, related.subCategoryId);
    const categoryLabel = getCategoryLabel(categories, related.categoryId);

    return {
      review: related,
      href: localizePath(`/content/${related.slug}`, lang),
      dateLabel: formatRelativeTime(related.createdAt, resolvedLang),
      ratingStars: buildRatingStars(related.ratingAvg),
      imageUrl:
        related.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
      imageAlt: related.title,
      avatarUrl:
        related.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index),
      avatarAlt: t(resolvedLang, "category.card.avatarAlt", {
        username: related.author.username,
      }),
      tagLabel:
        subCategoryLabel ??
        categoryLabel ??
        t(resolvedLang, "common.general"),
      likesLabel: formatCompactNumber(related.votesUp ?? 0, resolvedLang),
      commentsLabel: formatCompactNumber(related.commentCount ?? 0, resolvedLang),
    };
  });
}

async function RelatedReviewsSection({
  review,
  categories,
  categoryLabel,
  relatedCategoryHref,
  lang,
}: {
  review: Review;
  categories: Category[];
  categoryLabel?: string;
  relatedCategoryHref: string | null;
  lang: SupportedLanguage;
}) {
  let relatedReviews: Review[] = [];

  try {
    if (review.categoryId) {
      const relatedResult = await getCategoryPageDirect(
        review.categoryId,
        1,
        RELATED_FETCH_LIMIT,
        lang
      ).catch(() => ({ items: [] }));
      relatedReviews = relatedResult?.items ?? [];
    }
  } catch (error) {
    console.error("Failed to load related reviews", error);
  }

  if (relatedReviews.length === 0 && allowMockFallback) {
    relatedReviews = homepageReviewCards.map((card) => card.review);
  }

  const filteredRelatedReviews = relatedReviews
    .filter((item) => item.id !== review.id && item.slug !== review.slug)
    .slice(0, RELATED_LIMIT);
  const relatedCards = buildRelatedCards(
    filteredRelatedReviews,
    categories,
    lang
  );

  if (relatedCards.length === 0) {
    return null;
  }

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {t(lang, "reviewDetail.related.title")}
          </h3>
          {categoryLabel ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t(lang, "reviewDetail.related.subtitle", {
                category: categoryLabel,
              })}
            </p>
          ) : null}
        </div>
        {relatedCategoryHref ? (
          <Link
            href={relatedCategoryHref}
            className="text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
          >
            {t(lang, "reviewDetail.related.viewAll")}
          </Link>
        ) : null}
      </div>
      <div className="mt-6 flex flex-col gap-4">
        {relatedCards.map((card) => (
          <ReviewCardCategory key={card.review.id} {...card} />
        ))}
      </div>
    </section>
  );
}

async function ReviewCommentsSection({
  reviewId,
  commentCount,
  lang,
}: {
  reviewId: string;
  commentCount?: number | null;
  lang: SupportedLanguage;
}) {
  let comments: Comment[] = [];

  try {
    comments = await getReviewCommentsDirect(reviewId, 50).then(
      (res) => res.items
    );
  } catch (error) {
    console.error("Failed to load review comments", error);
  }

  if (comments.length === 0 && allowMockFallback) {
    comments = mockComments;
  }

  const commentCountLabel = formatCompactNumber(
    commentCount ?? comments.length,
    lang
  );

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        {t(lang, "reviewDetail.comments.title")}{" "}
        <span className="text-slate-400 font-normal text-lg">
          ({commentCountLabel})
        </span>
      </h3>

      <ReviewCommentForm reviewId={reviewId} avatarUrl={DEFAULT_AVATAR} />

      <div className="flex flex-col gap-8">
        {comments.length > 0 ? (
          comments.map((comment) => {
            const commentAvatarUrl = getOptimizedImageUrl(
              comment.author.profilePicUrl ?? DEFAULT_AVATAR,
              80
            );

            return (
              <div key={comment.id} className="flex gap-4">
                <Link
                  href={localizePath(`/users/${comment.author.username}`, lang)}
                  className="shrink-0"
                >
                  <div
                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-slate-100 dark:border-slate-700"
                    style={{ backgroundImage: `url("${commentAvatarUrl}")` }}
                  />
                </Link>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <Link
                      href={localizePath(
                        `/users/${comment.author.username}`,
                        lang
                      )}
                      className="font-bold text-slate-900 dark:text-white hover:text-primary transition-colors"
                    >
                      {comment.author.displayName || comment.author.username}
                    </Link>
                    <span className="text-xs text-slate-400">
                      {formatRelativeTime(comment.createdAt, lang)}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                    {comment.text}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <button className="text-slate-400 hover:text-primary text-xs font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">
                        thumb_up
                      </span>{" "}
                      0
                    </button>
                    <button className="text-slate-400 hover:text-primary text-xs font-medium">
                      {t(lang, "reviewDetail.comments.reply")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center text-slate-400 py-8 italic">
            {t(lang, "reviewDetail.comments.empty")}
          </p>
        )}
      </div>
    </section>
  );
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  let review: Review | null = null;
  let categories: Category[] = [];
  let productDetail: Product | null = null;
  let comments: Comment[] = [];

  try {
    review = await getReviewBySlugDirect(params.slug, lang);
    if (review?.translationLang && review.translationLang !== lang) {
      const fallbackSlug =
        review.translations?.find((translation) => translation.lang === DEFAULT_LANGUAGE)
          ?.slug ?? review.slug;
      redirect(localizePath(`/content/${fallbackSlug}`, DEFAULT_LANGUAGE));
    }

    const productSlug = review?.product?.slug;
    const [fetchedCategories, fetchedProduct, fetchedComments] = await Promise.all([
      getCategoriesDirect(lang),
      productSlug
        ? getProductBySlugDirect(productSlug, lang).catch(() => null)
        : Promise.resolve<Product | null>(null),
      review ? getReviewCommentsDirect(review.id, 50).then(res => res.items).catch(() => []) : Promise.resolve<Comment[]>([]),
    ]);
    categories = fetchedCategories;
    productDetail = fetchedProduct;
    comments = fetchedComments;
  } catch (error) {
    console.error("Failed to load review details", error);
  }

  if (!review && allowMockFallback) {
    review = mockReviewDetail;
  }

  if (!review) {
    notFound();
  }

  const extracted = parseReviewContent(review.contentHtml, review.excerpt);

  const ratingAvg = review.ratingAvg ?? 0;
  const ratingLabel = ratingAvg > 0 ? ratingAvg.toFixed(1) : t(lang, "productDetail.rating.none");
  const dateLabel = formatRelativeTime(review.createdAt, lang);

  const categoryLabel = getCategoryLabel(categories, review.categoryId);
  const subCategoryLabel = getCategoryLabel(categories, review.subCategoryId);
  const relatedCategoryHref = review.categoryId
    ? localizePath(`/catalog/reviews/${review.categoryId}`, lang)
    : null;
  const authorPic = getOptimizedImageUrl(
    review.author.profilePicUrl ?? DEFAULT_AVATAR,
    160
  );
  const productImg = getOptimizedImageUrl(
    review.photoUrls?.[0] ?? DEFAULT_REVIEW_IMAGE,
    480
  );
  const productSlug =
    productDetail?.translations?.find((translation) => translation.lang === lang)
      ?.slug ?? productDetail?.slug ?? review.product?.slug ?? "";
  const productLink = productSlug
    ? localizePath(`/products/${productSlug}`, lang)
    : null;
  // Use productDetail.name only if translation matches requested lang
  // Otherwise the API returned a fallback language translation
  const productNameFromDetail =
    productDetail?.translationLang === lang || !productDetail?.translationLang
      ? productDetail?.name
      : undefined;
  const productName =
    productNameFromDetail ?? review.product?.name ?? review.title;
  const productImage = getOptimizedImageUrl(
    productDetail?.images?.[0]?.url ?? productImg ?? DEFAULT_REVIEW_IMAGE,
    480
  );
  const productRatingAvg =
    productDetail?.stats?.ratingAvg ?? review.ratingAvg ?? 0;
  const productRatingCount =
    productDetail?.stats?.ratingCount ?? review.ratingCount ?? 0;
  const productReviewCount =
    productDetail?.stats?.reviewCount ?? review.ratingCount ?? 0;
  const authorName = review.author.displayName || review.author.username;
  const viewsLabel = formatCompactNumber(review.views ?? 0, lang);
  const votesUp = review.votesUp ?? 0;
  const reviewUrl = toAbsoluteUrl(localizePath(`/content/${review.slug}`, lang));
  const authorUrl = toAbsoluteUrl(
    localizePath(
      `/users/${encodeURIComponent(review.author.username.toLowerCase())}`,
      lang
    )
  );
  const organizationId = `${toAbsoluteUrl(localizePath("/", lang))}#organization`;
  const productUrl = productLink ? toAbsoluteUrl(productLink) : undefined;
  const reviewImageSource =
    review.photoUrls?.[0] ?? productDetail?.images?.[0]?.url ?? null;
  const reviewImage = reviewImageSource
    ? toAbsoluteUrl(reviewImageSource)
    : undefined;
  const reviewRatingValue =
    ratingAvg > 0 ? Number(ratingAvg.toFixed(1)) : undefined;
  const positiveNotes =
    review.pros && review.pros.length > 0
      ? {
        "@type": "ItemList",
        itemListElement: review.pros.map((note, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: note,
        })),
      }
      : undefined;
  const negativeNotes =
    review.cons && review.cons.length > 0
      ? {
        "@type": "ItemList",
        itemListElement: review.cons.map((note, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: note,
        })),
      }
      : undefined;
  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: t(lang, "reviewDetail.breadcrumb.home"),
      item: toAbsoluteUrl(localizePath("/", lang)),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: t(lang, "reviewDetail.breadcrumb.catalog"),
      item: toAbsoluteUrl(localizePath("/catalog", lang)),
    },
  ];
  if (categoryLabel) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbItems.length + 1,
      name: categoryLabel,
      item: toAbsoluteUrl(localizePath(`/catalog/reviews/${review.categoryId}`, lang)),
    });
  }
  if (subCategoryLabel && review.subCategoryId) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbItems.length + 1,
      name: subCategoryLabel,
      item: toAbsoluteUrl(
        localizePath(
          `/catalog/reviews/${review.categoryId}?subCategoryId=${review.subCategoryId}`,
          lang
        )
      ),
    });
  }
  breadcrumbItems.push({
    "@type": "ListItem",
    position: breadcrumbItems.length + 1,
    name: review.title,
    item: reviewUrl,
  });
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };
  const reviewJsonLd = {
    "@context": "https://schema.org",
    "@type": "Review",
    "@id": `${reviewUrl}#review`,
    name: review.title,
    headline: review.title,
    author: {
      "@type": "Person",
      name: authorName,
      url: authorUrl,
      image: authorPic ? toAbsoluteUrl(authorPic) : undefined,
    },
    itemReviewed: {
      "@type": "Product",
      "@id": productUrl ? `${productUrl}#product` : undefined,
      name: productName,
      image: productImage ? [toAbsoluteUrl(productImage)] : undefined,
      url: productUrl,
      aggregateRating:
        productRatingAvg > 0
          ? {
            "@type": "AggregateRating",
            ratingValue: productRatingAvg.toFixed(1),
            ratingCount: productRatingCount || 1, // Fallback to 1 if count is missing but avg exists
            reviewCount: productReviewCount || 1,
          }
          : undefined,
    },
    reviewRating:
      ratingAvg > 0
        ? {
          "@type": "Rating",
          ratingValue: reviewRatingValue ?? ratingAvg,
          bestRating: 5,
          worstRating: 1,
        }
        : undefined,
    reviewBody: review.excerpt ?? undefined,
    datePublished: review.createdAt,
    image: reviewImage ? [reviewImage] : undefined,
    inLanguage: lang,
    positiveNotes,
    negativeNotes,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": reviewUrl,
    },
    publisher: {
      "@id": organizationId,
    },
    comment: comments.map((c) => ({
      "@type": "Comment",
      text: c.text,
      datePublished: c.createdAt,
      author: {
        "@type": "Person",
        name: c.author.displayName || c.author.username,
        url: toAbsoluteUrl(
          localizePath(
            `/users/${encodeURIComponent(c.author.username.toLowerCase())}`,
            lang
          )
        ),
        image: c.author.profilePicUrl
          ? toAbsoluteUrl(c.author.profilePicUrl)
          : undefined,
      },
    })),
    url: reviewUrl,
  };

  // Build FAQ schema only from actual FAQ items visible on the page
  const faqItems: { question: string; answer: string }[] = [];

  if (review.faq && review.faq.length > 0) {
    review.faq.forEach((item) => {
      faqItems.push({
        question: item.question,
        answer: item.answer,
      });
    });
  }

  const faqJsonLd = faqItems.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  } : null;

  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbJsonLd)}
      </script>
      <script type="application/ld+json">{JSON.stringify(reviewJsonLd)}</script>
      {faqJsonLd && (
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      )}
      <ReviewDetailClient reviewId={review.id} />

      <div className="w-full flex justify-center py-8 px-4 md:px-8 bg-background-light dark:bg-background-dark">
        <div className="layout-content-container w-full max-w-7xl">
          {/* Breadcrumbs */}
          <nav
            className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-sub dark:text-gray-400 mb-8"
            aria-label="Breadcrumb"
          >
            <Link href={localizePath("/", lang)} className="hover:text-primary transition-colors">
              {t(lang, "reviewDetail.breadcrumb.home")}
            </Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <Link
              href={localizePath("/catalog", lang)}
              className="hover:text-primary transition-colors"
            >
              {t(lang, "reviewDetail.breadcrumb.catalog")}
            </Link>
            {categoryLabel && (
              <>
                <span className="text-gray-300 dark:text-gray-600">/</span>
                <Link
                  href={localizePath(`/catalog/reviews/${review.categoryId}`, lang)}
                  className="hover:text-primary transition-colors"
                >
                  {categoryLabel}
                </Link>
              </>
            )}
            {subCategoryLabel && (
              <>
                <span className="text-gray-300 dark:text-gray-600">/</span>
                <Link
                  href={localizePath(
                    `/catalog/reviews/${review.categoryId}?subCategoryId=${review.subCategoryId}`,
                    lang
                  )}
                  className="hover:text-primary transition-colors"
                >
                  {subCategoryLabel}
                </Link>
              </>
            )}
          </nav>

          <div className="flex flex-col lg:flex-row gap-12 items-start">
            {/* Main Content Area */}
            <main className="flex-1 w-full lg:w-2/3 flex flex-col gap-10">
              {productName ? (
                <section className="bg-gray-50 dark:bg-surface-dark/50 rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productImage}
                    alt={productName}
                    className="w-24 h-24 object-contain object-centershrink-0 mix-blend-multiply dark:mix-blend-normal"
                    decoding="async"
                    fetchPriority="high"
                    loading="eager"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {categoryLabel && (
                        <span className="text-xs font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-md">
                          {categoryLabel}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black text-text-main dark:text-white leading-tight mb-2">
                      {productLink ? (
                        <Link href={productLink} className="hover:text-primary transition-colors">
                          {productName}
                        </Link>
                      ) : (
                        productName
                      )}
                    </h2>
                    {productDetail?.description && (
                      <p className="text-sm text-text-sub dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">
                        {productDetail.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-text-main dark:text-white">{productRatingAvg.toFixed(1)}</span>
                        <RatingStarsCatalog
                          stars={buildRatingStars(productRatingAvg)}
                          valueText=""
                        />
                        <span className="text-xs text-text-muted">({formatNumber(productRatingCount, lang)})</span>
                      </div>

                      {productSlug && (
                        <div className="flex items-center gap-2">
                          {productLink && (
                            <Link
                              className="text-sm font-bold text-primary hover:underline"
                              href={productLink}
                            >
                              {t(lang, "productCard.viewProduct")}
                            </Link>
                          )}
                          <Link
                            className="text-sm font-bold text-text-main dark:text-white hover:underline"
                            href={`${localizePath("/node/add/review", lang)}?productSlug=${encodeURIComponent(
                              productSlug
                            )}`}
                          >
                            {t(lang, "productDetail.cta.writeReview")}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              ) : null}

              <article>
                <header className="mb-8 px-4 md:px-0">
                  <h1 className="text-text-main dark:text-white text-3xl md:text-5xl font-black leading-tight tracking-tight mb-6">
                    {review.title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-6 text-sm text-text-sub dark:text-gray-400">
                    <div className="flex items-center gap-3">
                      <Link
                        href={localizePath(
                          `/users/${encodeURIComponent(review.author.username.toLowerCase())}`,
                          lang
                        )}
                        className="flex items-center gap-2 group"
                      >
                        <div
                          className="bg-center bg-no-repeat bg-cover rounded-full size-10 bg-gray-100 dark:bg-gray-800"
                          style={{ backgroundImage: `url("${authorPic}")` }}
                        />
                        <span className="font-bold text-text-main dark:text-white group-hover:text-primary transition-colors">
                          {authorName}
                        </span>
                      </Link>
                    </div>
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                    <span>{dateLabel}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                    <div className="flex items-center gap-1">
                      <RatingStarsCatalog stars={buildRatingStars(review.ratingAvg)} valueText={ratingLabel} />
                    </div>
                  </div>
                </header>

                <div className="bg-white dark:bg-surface-dark rounded-none md:rounded-2xl p-5 md:p-10 shadow-sm md:shadow-none md:border border-gray-100 dark:border-gray-800">

                  {/* Pros & Cons - Cleaner */}
                  {((review.pros && review.pros.length > 0) || (review.cons && review.cons.length > 0) || extracted.pros.length > 0 || extracted.cons.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                      {((review.pros && review.pros.length > 0) || extracted.pros.length > 0) && (
                        <div>
                          <h4 className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold text-lg mb-4">
                            <span className="material-symbols-outlined">check_circle</span>
                            {t(lang, "reviewDetail.pros")}
                          </h4>
                          <ul className="space-y-3">
                            {((review.pros && review.pros.length > 0) ? review.pros : extracted.pros).map((p, idx) => (
                              <li key={idx} className="flex items-start gap-3 text-base text-text-main dark:text-gray-300">
                                <span className="mt-1.5 block w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span>
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {((review.cons && review.cons.length > 0) || extracted.cons.length > 0) && (
                        <div>
                          <h4 className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-lg mb-4">
                            <span className="material-symbols-outlined">cancel</span>
                            {t(lang, "reviewDetail.cons")}
                          </h4>
                          <ul className="space-y-3">
                            {((review.cons && review.cons.length > 0) ? review.cons : extracted.cons).map((c, idx) => (
                              <li key={idx} className="flex items-start gap-3 text-base text-text-main dark:text-gray-300">
                                <span className="mt-1.5 block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <AdSquare />

                  {/* Gallery */}
                  {review.photoUrls && review.photoUrls.length > 0 && (

                    <div className="mb-12">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-xl overflow-hidden">
                        {review.photoUrls.map((url, idx) => (
                          <div
                            key={idx}
                            className="aspect-square bg-gray-100 dark:bg-gray-800 hover:opacity-90 transition-opacity cursor-zoom-in relative"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getOptimizedImageUrl(url, 640)}
                              alt={t(lang, "reviewDetail.gallery")}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              decoding="async"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="prose prose-lg dark:prose-invert prose-slate max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary prose-img:rounded-xl">
                    {/* Summary Section */}
                    {review.summary && (
                      <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                          {t(lang, "reviewDetail.summarySection")}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                          {review.summary}
                        </p>
                      </div>
                    )}

                    {/* Table of Contents (Moved Inline) */}
                    {extracted.blocks.some(b => b.type === "h2" || b.type === "h3") && (
                      <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-l-4 border-primary">
                        <TableOfContents contentSelector=".prose" titleLabel={t(lang, "common.tableOfContents")} />
                      </div>
                    )}

                    {/* Specifications Section */}
                    {review.specs && Object.keys(review.specs).length > 0 && (
                      <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                          {t(lang, "reviewDetail.specsSection")}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                          {Object.entries(review.specs).map(([key, value], idx) => (
                            <div key={idx} className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-2">
                              <span className="font-medium text-slate-700 dark:text-slate-300">{key}</span>
                              <span className="text-slate-600 dark:text-slate-400">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {extracted.blocks.length > 0 ? (
                      extracted.blocks.map((block, index) => {
                        const BlockTag = block.type === 'p' ? 'p' : block.type;

                        // Calculate ad insertion points
                        const showFirstAd = index === 3; // Approx after 3rd block (likely intro + 1-2 headers/paras)
                        const showSecondAd = index === 12; // Approx mid-content for longer articles

                        return (
                          <div key={index}>
                            {/* @ts-ignore */}
                            <BlockTag id={(block as any).id}>{block.content}</BlockTag>
                            {showFirstAd && <AdSquare />}
                            {showSecondAd && <AdSquare />}
                          </div>
                        );
                      })

                    ) : (
                      <p>{review.excerpt}</p>
                    )}

                    {/* FAQ */}
                    {review.faq && review.faq.length > 0 && (
                      <>
                        <AdSquare />
                        <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800">
                          <h2 className="mb-6">{t(lang, "reviewDetail.faqSection")}</h2>

                          <div className="space-y-6 not-prose">
                            {review.faq.map((item, idx) => (
                              <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl">
                                <h3 className="text-lg font-bold text-text-main dark:text-white mb-2">
                                  {item.question}
                                </h3>
                                <div
                                  className="text-text-sub dark:text-gray-300 leading-relaxed"
                                  dangerouslySetInnerHTML={{ __html: item.answer }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                  </div>

                  {/* Action Bar */}
                  <div className="mt-12 flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <ReviewHelpfulButton reviewId={review.id} votesUp={votesUp} />
                    <div className="flex gap-4">
                      <button className="flex items-center gap-2 text-text-sub hover:text-primary transition-colors text-sm font-medium">
                        <span className="material-symbols-outlined text-lg">share</span>
                        {t(lang, "reviewDetail.helpfulReview.share")}
                      </button>
                      <button className="flex items-center gap-2 text-text-sub hover:text-red-500 transition-colors text-sm font-medium">
                        <span className="material-symbols-outlined text-lg">flag</span>
                      </button>
                    </div>
                  </div>

                  {/* End of Content Multiplex Ad */}
                  <AdMultiplex />

                </div>
              </article>

              <Suspense fallback={<ReviewRelatedSkeleton />}>
                <RelatedReviewsSection
                  review={review}
                  categories={categories}
                  categoryLabel={categoryLabel}
                  relatedCategoryHref={relatedCategoryHref}
                  lang={lang}
                />
              </Suspense>

              <Suspense fallback={<ReviewCommentsSkeleton />}>
                <ReviewCommentsSection
                  reviewId={review.id}
                  commentCount={review.commentCount}
                  lang={lang}
                />
              </Suspense>
            </main>

            {/* Sidebar - Simplified */}
            <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-8">
              <AdVertical className="sticky top-24 z-10" />

              {/* Context Widget */}

              <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                <h4 className="font-bold text-text-main dark:text-white mb-6 flex items-center gap-2 text-lg">
                  {t(lang, "reviewDetail.productContext")}
                </h4>
                <div className="flex flex-col items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productImage}
                    alt={productName}
                    referrerPolicy="no-referrer"
                    className="w-48 h-48 object-contain object-center mb-4 p-4"
                    decoding="async"
                    loading="lazy"
                  />
                  <h3 className="text-center font-bold text-lg text-text-main dark:text-white mb-2">
                    {productName}
                  </h3>
                  <div className="flex items-center justify-center gap-1 mb-6">
                    <RatingStarsCatalog
                      stars={buildRatingStars(productRatingAvg)}
                      valueText={
                        productRatingAvg > 0
                          ? productRatingAvg.toFixed(1)
                          : t(lang, "productDetail.rating.none")
                      }
                    />
                  </div>
                  {productLink ? (
                    <Link
                      href={productLink}
                      className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold text-center hover:bg-primary-dark transition-colors"
                    >
                      {t(lang, "productCard.viewProduct")}
                    </Link>
                  ) : (
                    <Link
                      href={localizePath(`/catalog/reviews/${review.categoryId}`, lang)}
                      className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-text-main dark:text-white rounded-xl text-sm font-bold text-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {t(lang, "reviewDetail.viewCategoryItems")}
                    </Link>
                  )}
                </div>
              </div>

              {/* Share Widget */}
              <div className="bg-gradient-to-br from-primary to-blue-600 rounded-2xl p-8 text-white text-center shadow-lg">
                <div className="mb-4 flex justify-center">
                  <span className="material-symbols-outlined text-4xl bg-white/20 p-3 rounded-full">campaign</span>
                </div>
                <h4 className="font-bold text-xl mb-2">
                  {t(lang, "reviewDetail.helpfulReview.title")}
                </h4>
                <p className="text-blue-100 text-sm mb-6 leading-relaxed">
                  {t(lang, "reviewDetail.helpfulReview.description")}
                </p>
                <button className="w-full bg-white text-primary py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">
                  {t(lang, "reviewDetail.helpfulReview.share")}
                </button>
              </div>

            </aside>
          </div>
        </div>
      </div >
    </>
  );
}
