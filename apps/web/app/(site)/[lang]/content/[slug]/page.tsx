import Link from "next/link";
import { redirect } from "next/navigation";
import ReviewDetailClient, {
  ReviewCommentForm,
  ReviewHelpfulButton,
} from "@/components/reviews/ReviewDetailClient";
import type { Metadata } from "next";
import type { Review, Comment, Category, Product } from "@/src/types";
import {
  getReviewBySlug,
  getReviewComments,
  getCategories,
  getCategoryPage,
  getProductBySlug,
} from "@/src/lib/api";
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
  const review = await getReviewBySlug(params.slug, lang).catch(() => null);
  if (!review) {
    return buildMetadata({
      title: t(lang, "reviewDetail.meta.notFoundTitle"),
      description: t(lang, "reviewDetail.meta.notFoundDescription"),
      path: `/content/${params.slug}`,
      lang,
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
  const title = review.metaTitle ?? review.title;
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
      const id = `heading-${headerCount++}`;
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
      const id = `heading-${headerCount++}`;
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

export default async function Page(props: PageProps) {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  let review: Review | null = null;
  let comments: Comment[] = [];
  let categories: Category[] = [];
  let productDetail: Product | null = null;
  let relatedReviews: Review[] = [];

  try {
    review = await getReviewBySlug(params.slug, lang);
    if (review?.translationLang && review.translationLang !== lang) {
      const fallbackSlug =
        review.translations?.find((translation) => translation.lang === DEFAULT_LANGUAGE)
          ?.slug ?? review.slug;
      redirect(localizePath(`/content/${fallbackSlug}`, DEFAULT_LANGUAGE));
    }

    const productSlug = review?.product?.slug;
    const relatedPromise = review?.categoryId
      ? getCategoryPage(
        review.categoryId,
        1,
        RELATED_FETCH_LIMIT,
        "latest",
        undefined,
        lang
      ).catch(() => null)
      : Promise.resolve(null);
    const [fetchedComments, fetchedCategories, fetchedProduct, relatedResult] = await Promise.all([
      review
        ? getReviewComments(review.id, 50).then((res) => res.items)
        : Promise.resolve<Comment[]>([]),
      getCategories(lang),
      productSlug
        ? getProductBySlug(productSlug, lang).catch(() => null)
        : Promise.resolve<Product | null>(null),
      relatedPromise,
    ]);
    comments = fetchedComments;
    categories = fetchedCategories;
    productDetail = fetchedProduct;
    relatedReviews = relatedResult?.items ?? [];

  } catch (error) {
    console.error("Failed to load review details", error);
  }

  if (!review && allowMockFallback) {
    review = mockReviewDetail;
    comments = mockComments;
    relatedReviews = homepageReviewCards.map((card) => card.review);
  }

  if (!review) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">
          {t(lang, "reviewDetail.notFound.title")}
        </h1>
        <p className="text-slate-600 mb-6">
          {t(lang, "reviewDetail.notFound.description")}
        </p>
        <Link
          href={localizePath("/catalog", lang)}
          className="bg-primary text-white px-6 py-2 rounded-lg font-bold"
        >
          {t(lang, "reviewDetail.notFound.cta")}
        </Link>
      </div>
    );
  }

  const extracted = parseReviewContent(review.contentHtml, review.excerpt);

  const ratingAvg = review.ratingAvg ?? 0;
  const ratingLabel =
    ratingAvg > 0 ? ratingAvg.toFixed(1) : t(lang, "productDetail.rating.none");
  const dateLabel = formatRelativeTime(review.createdAt, lang);
  const categoryLabel = getCategoryLabel(categories, review.categoryId);
  const subCategoryLabel = getCategoryLabel(categories, review.subCategoryId);
  const relatedCategoryHref = review.categoryId
    ? localizePath(`/catalog/reviews/${review.categoryId}`, lang)
    : null;
  const filteredRelatedReviews = relatedReviews
    .filter((item) => item.id !== review.id && item.slug !== review.slug)
    .slice(0, RELATED_LIMIT);
  const relatedCards = buildRelatedCards(
    filteredRelatedReviews,
    categories,
    lang
  );
  const authorPic = getOptimizedImageUrl(
    review.author.profilePicUrl ?? DEFAULT_AVATAR,
    160
  );
  const productImg = getOptimizedImageUrl(
    review.photoUrls?.[0] ?? DEFAULT_REVIEW_IMAGE,
    900
  );
  const productSlug =
    productDetail?.translations?.find((translation) => translation.lang === lang)
      ?.slug ?? productDetail?.slug ?? review.product?.slug ?? "";
  const productLink = productSlug
    ? localizePath(`/products/${productSlug}`, lang)
    : null;
  const productName =
    productDetail?.name ?? review.product?.name ?? review.title;
  const productImage = getOptimizedImageUrl(
    productDetail?.images?.[0]?.url ?? productImg ?? DEFAULT_REVIEW_IMAGE,
    900
  );
  const productRatingAvg =
    productDetail?.stats?.ratingAvg ?? review.ratingAvg ?? 0;
  const productRatingCount =
    productDetail?.stats?.ratingCount ?? review.ratingCount ?? 0;
  const productReviewCount =
    productDetail?.stats?.reviewCount ?? review.ratingCount ?? 0;
  const authorName = review.author.displayName || review.author.username;
  const viewsLabel = formatCompactNumber(review.views ?? 0, lang);
  const commentCountLabel = formatCompactNumber(
    review.commentCount ?? comments.length,
    lang
  );
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

  // Build FAQ schema from pros and cons for rich snippets
  const faqItems: { question: string; answer: string }[] = [];

  // Add pros as FAQ items
  if (review.pros && review.pros.length > 0) {
    faqItems.push({
      question: t(lang, "faq.whatArePros", { product: productName }),
      answer: review.pros.join(". ") + ".",
    });
    // Individual pros as separate FAQ items (max 2)
    review.pros.slice(0, 2).forEach((pro, idx) => {
      faqItems.push({
        question: t(lang, "faq.whyGood", { feature: pro.split(" ").slice(0, 5).join(" ") }),
        answer: pro,
      });
    });
  }

  // Add cons as FAQ items
  if (review.cons && review.cons.length > 0) {
    faqItems.push({
      question: t(lang, "faq.whatAreCons", { product: productName }),
      answer: review.cons.join(". ") + ".",
    });
    // Individual cons as separate FAQ items (max 2)
    review.cons.slice(0, 2).forEach((con, idx) => {
      faqItems.push({
        question: t(lang, "faq.anyIssues", { feature: con.split(" ").slice(0, 5).join(" ") }),
        answer: con,
      });
    });
  }

  // Add general review questions
  if (ratingAvg > 0) {
    faqItems.push({
      question: t(lang, "faq.isWorthIt", { product: productName }),
      answer: ratingAvg >= 4
        ? t(lang, "faq.worthItYes", { product: productName, rating: ratingAvg.toFixed(1) })
        : ratingAvg >= 3
          ? t(lang, "faq.worthItMaybe", { product: productName, rating: ratingAvg.toFixed(1) })
          : t(lang, "faq.worthItNo", { product: productName, rating: ratingAvg.toFixed(1) }),
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

      <div className="w-full flex justify-center py-6 px-0 md:px-10 lg:px-20 bg-background-light dark:bg-background-dark">
        <div className="layout-content-container w-full max-w-7xl">
          {/* Breadcrumbs */}
          <nav
            className="flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6 px-4 md:px-0"
            aria-label="Breadcrumb"
          >
            <Link href={localizePath("/", lang)} className="hover:text-primary transition-colors">
              {t(lang, "reviewDetail.breadcrumb.home")}
            </Link>
            <span className="text-slate-300">/</span>
            <Link
              href={localizePath("/catalog", lang)}
              className="hover:text-primary transition-colors"
            >
              {t(lang, "reviewDetail.breadcrumb.catalog")}
            </Link>
            {categoryLabel && (
              <>
                <span className="text-slate-300">/</span>
                <Link
                  href={localizePath(`/catalog?categoryId=${review.categoryId}`, lang)}
                  className="hover:text-primary transition-colors"
                >
                  {categoryLabel}
                </Link>
              </>
            )}
            {subCategoryLabel && (
              <>
                <span className="text-slate-300">/</span>
                <Link
                  href={localizePath(
                    `/catalog?categoryId=${review.categoryId}&subCategoryId=${review.subCategoryId}`,
                    lang
                  )}
                  className="hover:text-primary transition-colors"
                >
                  {subCategoryLabel}
                </Link>
              </>
            )}
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">{review.title}</span>
          </nav>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Main Content Area */}
            <main className="flex-1 w-full lg:w-2/3 flex flex-col gap-8">
              {productName ? (
                <section className="bg-white dark:bg-slate-800 rounded-none md:rounded-xl shadow-sm border-y md:border border-slate-200 dark:border-slate-700 p-6 md:p-8 flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row gap-5 items-start">
                    <img
                      src={productImage}
                      alt={productName}
                      className="w-28 h-28 object-contain object-center rounded-xl bg-slate-100 dark:bg-slate-700 shrink-0"
                      decoding="async"
                    />
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {categoryLabel ? (
                          <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 font-semibold text-slate-600 dark:text-slate-300">
                            {categoryLabel}
                          </span>
                        ) : null}
                        {subCategoryLabel ? (
                          <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 font-semibold text-slate-600 dark:text-slate-300">
                            {subCategoryLabel}
                          </span>
                        ) : null}
                      </div>
                      <div>
                        {productLink ? (
                          <Link
                            href={productLink}
                            className="text-2xl font-bold text-slate-900 dark:text-white hover:text-primary transition-colors"
                          >
                            {productName}
                          </Link>
                        ) : (
                          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {productName}
                          </h2>
                        )}
                        {productDetail?.description ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                            {productDetail.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <div>
                          <RatingStarsCatalog
                            stars={buildRatingStars(productRatingAvg)}
                            valueText={
                              productRatingAvg > 0
                                ? productRatingAvg.toFixed(1)
                                : t(lang, "productDetail.rating.none")
                            }
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t(lang, "productDetail.rating.countLabel", {
                              count: formatNumber(productRatingCount, lang),
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatNumber(productReviewCount, lang)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t(lang, "productDetail.review.countLabel")}
                          </p>
                        </div>
                      </div>
                      {productSlug ? (
                        <div className="flex flex-wrap items-center gap-3">
                          {productLink ? (
                            <Link
                              className="inline-flex items-center justify-center rounded-lg bg-primary text-white text-xs font-semibold px-4 py-2 hover:bg-primary-dark"
                              href={productLink}
                            >
                              {t(lang, "productCard.viewProduct")}
                            </Link>
                          ) : null}
                          <Link
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold px-4 py-2 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary"
                            href={`${localizePath("/node/add/review", lang)}?productSlug=${encodeURIComponent(
                              productSlug
                            )}`}
                          >
                            {t(lang, "productDetail.cta.writeReview")}
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}

              <article className="bg-white dark:bg-slate-800 rounded-none md:rounded-xl shadow-sm border-y md:border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Review Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex flex-col gap-4">
                    <h1 className="text-slate-900 dark:text-white text-3xl md:text-4xl font-extrabold leading-tight tracking-tight">
                      {review.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm mt-2">
                      <div className="flex items-center">
                        <RatingStarsCatalog stars={buildRatingStars(review.ratingAvg)} valueText={ratingLabel} />
                      </div>
                      <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block"></span>
                      <span className="text-slate-500 whitespace-nowrap">
                        {t(lang, "reviewDetail.postedLabel", { relative: dateLabel })}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block"></span>
                      <div className="flex items-center gap-1 text-slate-500 whitespace-nowrap">
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                        <span>
                          {t(lang, "reviewDetail.viewsLabel", { count: viewsLabel })}
                        </span>
                      </div>
                    </div>

                    {/* Author Mini Profile */}
                    <div className="flex items-center gap-4 mt-2 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-700 group">
                      <Link
                        href={localizePath(
                          `/users/${encodeURIComponent(review.author.username.toLowerCase())}`,
                          lang
                        )}
                        className="shrink-0"
                      >
                        <div
                          className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 border border-slate-200 dark:border-slate-600"
                          style={{ backgroundImage: `url("${authorPic}")` }}
                        />
                      </Link>
                      <div className="flex flex-col">
                        <Link
                          href={localizePath(
                            `/users/${encodeURIComponent(review.author.username.toLowerCase())}`,
                            lang
                          )}
                          className="text-slate-900 dark:text-white font-bold text-lg hover:text-primary transition-colors"
                        >
                          {authorName}
                        </Link>
                        <span className="text-slate-500 dark:text-slate-400 text-sm">
                          {t(lang, "reviewDetail.authorRole")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pros & Cons */}
                {(extracted.pros.length > 0 || extracted.cons.length > 0) && (
                  <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-900/10 border-b border-slate-100 dark:border-slate-700">
                    {extracted.pros.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <h4 className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold">
                          <span className="material-symbols-outlined">add_circle</span>{" "}
                          {t(lang, "reviewDetail.pros")}
                        </h4>
                        <ul className="space-y-2">
                          {extracted.pros.map((p, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <span className="mt-1 block w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {extracted.cons.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <h4 className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold">
                          <span className="material-symbols-outlined">remove_circle</span>{" "}
                          {t(lang, "reviewDetail.cons")}
                        </h4>
                        <ul className="space-y-2">
                          {extracted.cons.map((c, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <span className="mt-1 block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Gallery */}
                {review.photoUrls && review.photoUrls.length > 0 && (
                  <div className="p-6 md:p-8 pb-0">
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-4">
                      {t(lang, "reviewDetail.gallery")}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {review.photoUrls.map((url, idx) => (
                        <div
                          key={idx}
                          className="aspect-square bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:scale-[1.02] transition-transform cursor-zoom-in overflow-hidden"
                        >
                          <img
                            src={url}
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

                {/* Main Content Body */}
                <div className="flex flex-col-reverse lg:flex-row gap-8">
                  <div className="flex-1 p-6 md:p-8 prose dark:prose-invert prose-slate max-w-none">
                    {extracted.blocks.length > 0 ? (
                      extracted.blocks.map((block, index) => {
                        if (block.type === "h2") {
                          return (
                            <h2 key={`block-${index}`} id={block.id} className="text-2xl font-bold text-slate-900 dark:text-white mt-8 mb-4">
                              {block.content}
                            </h2>
                          );
                        }
                        if (block.type === "h3") {
                          return (
                            <h3 key={`block-${index}`} id={block.id} className="text-xl font-semibold text-slate-800 dark:text-slate-100 mt-6 mb-3">
                              {block.content}
                            </h3>
                          );
                        }
                        return (
                          <p
                            key={`block-${index}`}
                            className="text-slate-600 dark:text-slate-300 leading-relaxed mb-6"
                          >
                            {block.content.split("\n").map((line, lineIndex, lines) => (
                              <span key={`line-${lineIndex}`}>
                                {line}
                                {lineIndex < lines.length - 1 ? (
                                  <br />
                                ) : null}
                              </span>
                            ))}
                          </p>
                        );
                      })
                    ) : (
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                        {review.excerpt ?? ""}
                      </p>
                    )}
                  </div>
                  {extracted.blocks.some(b => b.type === "h2" || b.type === "h3") && (
                    <div className="p-6 lg:pl-0 lg:pt-8 w-full lg:w-auto">
                      <TableOfContents contentSelector=".prose" titleLabel={t(lang, "common.tableOfContents")} />
                    </div>
                  )}
                </div>

                {/* Helpful Bar */}
                <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                  <ReviewHelpfulButton reviewId={review.id} votesUp={votesUp} />
                  <div className="flex gap-4">
                    <button className="text-slate-400 hover:text-primary transition-colors">
                      <span className="material-symbols-outlined">share</span>
                    </button>
                    <button className="text-slate-400 hover:text-red-500 transition-colors">
                      <span className="material-symbols-outlined">flag</span>
                    </button>
                  </div>
                </div>
              </article>

              {relatedCards.length > 0 ? (
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
              ) : null}

              {/* Comments Section */}
              <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  {t(lang, "reviewDetail.comments.title")}{" "}
                  <span className="text-slate-400 font-normal text-lg">
                    ({commentCountLabel})
                  </span>
                </h3>

                {/* Inline Comment Form */}
                <ReviewCommentForm reviewId={review.id} avatarUrl={DEFAULT_AVATAR} />

                {/* Comments List */}
                <div className="flex flex-col gap-8">
                  {comments.length > 0 ? comments.map((comment) => {
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
                              href={localizePath(`/users/${comment.author.username}`, lang)}
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
                              <span className="material-symbols-outlined text-[16px]">thumb_up</span> 0
                            </button>
                            <button className="text-slate-400 hover:text-primary text-xs font-medium">
                              {t(lang, "reviewDetail.comments.reply")}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="text-center text-slate-400 py-8 italic">
                      {t(lang, "reviewDetail.comments.empty")}
                    </p>
                  )}
                </div>
              </section>
            </main>

            {/* Sidebar */}
            <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                <h4 className="font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">info</span>
                  {t(lang, "reviewDetail.productContext")}
                </h4>
                <div className="flex flex-col items-center py-2">
                  <img
                    src={productImage}
                    alt={productName}
                    referrerPolicy="no-referrer"
                    className="w-40 h-40 object-contain object-center mb-4 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                    decoding="async"
                  />
                  <h3 className="text-center font-bold text-slate-900 dark:text-white mb-2">
                    {productName}
                  </h3>
                  <div className="flex items-center gap-1 text-primary">
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
                      className="mt-4 w-full py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold text-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      {t(lang, "productCard.viewProduct")}
                    </Link>
                  ) : (
                    <Link
                      href={localizePath(`/catalog?categoryId=${review.categoryId}`, lang)}
                      className="mt-4 w-full py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold text-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      {t(lang, "reviewDetail.viewCategoryItems")}
                    </Link>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary to-blue-600 rounded-xl shadow-md p-6 text-white text-center">
                <h4 className="font-bold text-lg mb-2">
                  {t(lang, "reviewDetail.helpfulReview.title")}
                </h4>
                <p className="text-blue-100 text-xs mb-4">
                  {t(lang, "reviewDetail.helpfulReview.description")}
                </p>
                <div className="flex gap-2">
                  <button className="flex-1 bg-white text-primary py-2 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors">
                    {t(lang, "reviewDetail.helpfulReview.share")}
                  </button>
                  <button className="flex-1 bg-white/20 text-white py-2 rounded-lg text-xs font-bold hover:bg-white/30 transition-colors">
                    {t(lang, "reviewDetail.helpfulReview.save")}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div >
    </>
  );
}
