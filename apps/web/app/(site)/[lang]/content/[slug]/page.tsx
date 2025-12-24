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
  getProductBySlug,
} from "@/src/lib/api";
import {
  DEFAULT_AVATAR,
  DEFAULT_REVIEW_IMAGE,
  buildRatingStars,
  formatCompactNumber,
  formatNumber,
  formatRelativeTime,
  getCategoryLabel,
} from "@/src/lib/review-utils";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";
import { buildMetadata, toAbsoluteUrl } from "@/src/lib/seo";
import { allowMockFallback } from "@/src/lib/runtime";
import { homepageReviewCards } from "@/data/mock/reviews";
import { RatingStarsCatalog } from "@/components/ui/RatingStars";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  localizePath,
  normalizeLanguage,
  type SupportedLanguage,
} from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

export const revalidate = 120;


type PageProps = {
  params: Promise<{ lang: string; slug: string }>;
};

const SITE_NAME = "UserReview";

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

type ReviewContent = {
  paragraphs: string[];
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
  const normalized = baseText.replace(/\r\n/g, "\n").trim();
  const sanitized = normalized
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .trim();

  if (!sanitized) {
    return { paragraphs: [], pros: [], cons: [] };
  }

  const sections = sanitized
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);
  const paragraphs: string[] = [];
  const pros: string[] = [];
  const cons: string[] = [];

  sections.forEach((section) => {
    const lines = section
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return;
    }

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

    paragraphs.push(lines.join("\n"));
  });

  return { paragraphs, pros, cons };
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  let review: Review | null = null;
  let comments: Comment[] = [];
  let categories: Category[] = [];
  let productDetail: Product | null = null;

  try {
    review = await getReviewBySlug(params.slug, lang);
    if (review?.translationLang && review.translationLang !== lang) {
      const fallbackSlug =
        review.translations?.find((translation) => translation.lang === DEFAULT_LANGUAGE)
          ?.slug ?? review.slug;
      redirect(localizePath(`/content/${fallbackSlug}`, DEFAULT_LANGUAGE));
    }

    const productSlug = review?.product?.slug;
    const [fetchedComments, fetchedCategories, fetchedProduct] = await Promise.all([
      review
        ? getReviewComments(review.id, 50).then((res) => res.items)
        : Promise.resolve<Comment[]>([]),
      getCategories(lang),
      productSlug
        ? getProductBySlug(productSlug, lang).catch(() => null)
        : Promise.resolve<Product | null>(null),
    ]);
    comments = fetchedComments;
    categories = fetchedCategories;
    productDetail = fetchedProduct;

  } catch (error) {
    console.error("Failed to load review details", error);
  }

  if (!review && allowMockFallback) {
    review = mockReviewDetail;
    comments = mockComments;
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
    },
    itemReviewed: {
      "@type": "Product",
      name: productName,
      image: productImage ? [toAbsoluteUrl(productImage)] : undefined,
      url: productLink ? toAbsoluteUrl(productLink) : undefined,
    },
    reviewRating:
      ratingAvg > 0
        ? {
          "@type": "Rating",
          ratingValue: ratingAvg.toFixed(1),
          bestRating: "5",
          worstRating: "1",
        }
        : undefined,
    reviewBody: review.excerpt ?? undefined,
    datePublished: review.createdAt,
    inLanguage: lang,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    url: reviewUrl,
  };

  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbJsonLd)}
      </script>
      <script type="application/ld+json">{JSON.stringify(reviewJsonLd)}</script>
      <ReviewDetailClient reviewId={review.id} />

      <div className="w-full flex justify-center py-6 px-4 md:px-10 lg:px-20 bg-background-light dark:bg-background-dark">
        <div className="layout-content-container w-full max-w-7xl">
          {/* Breadcrumbs */}
          <nav
            className="flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6"
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
                <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8 flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row gap-5 items-start">
                    <img
                      src={productImage}
                      alt={productName}
                      className="w-28 h-28 object-contain object-center rounded-xl bg-slate-100 dark:bg-slate-700 shrink-0"
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

              <article className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
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
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Content Body */}
                <div className="p-6 md:p-8 prose dark:prose-invert prose-slate max-w-none">
                  {extracted.paragraphs.length > 0 ? (
                    extracted.paragraphs.map((paragraph, index) => (
                      <p
                        key={`paragraph-${index}`}
                        className="text-slate-600 dark:text-slate-300 leading-relaxed mb-6"
                      >
                        {paragraph.split("\n").map((line, lineIndex, lines) => (
                          <span key={`line-${lineIndex}`}>
                            {line}
                            {lineIndex < lines.length - 1 ? (
                              <br />
                            ) : null}
                          </span>
                        ))}
                      </p>
                    ))
                  ) : (
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                      {review.excerpt ?? ""}
                    </p>
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
      </div>
    </>
  );
}
