import Link from "next/link";
import ReviewDetailClient from "@/components/reviews/ReviewDetailClient";
import type { Metadata } from "next";
import type { Review, Comment, Category } from "@/src/types";
import {
  getReviewBySlug,
  getReviewComments,
  getCategories,
  incrementReviewView,
} from "@/src/lib/api";
import {
  DEFAULT_AVATAR,
  DEFAULT_REVIEW_IMAGE,
  buildRatingStars,
  formatCompactNumber,
  formatRelativeTime,
  getCategoryLabel,
} from "@/src/lib/review-utils";
import { buildMetadata } from "@/src/lib/seo";
import { allowMockFallback } from "@/src/lib/runtime";
import { homepageReviewCards } from "@/data/mock/reviews";
import { RatingStarsCatalog } from "@/components/ui/RatingStars";

export const runtime = "edge";

type PageProps = {
  params: { slug: string };
};

const mockReviewDetail = homepageReviewCards[0].review;
const mockComments: Comment[] = [];

const AVATAR_PLACEHOLDER =
  "https://cdn.usegalileo.ai/stability/117654e4-ffc8-471d-bca5-0ebf306ed967.png";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const review = await getReviewBySlug(params.slug).catch(() => null);
  if (!review) {
    return buildMetadata({
      title: "Review Not Found",
      description: "The requested review could not be found.",
      path: `/content/${params.slug}`,
    });
  }

  return buildMetadata({
    title: review.title,
    description: review.excerpt ?? "Read the full review and user experiences.",
    path: `/content/${review.slug}`,
    type: "article",
    image: review.photoUrls?.[0],
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

export default async function Page({ params }: PageProps) {
  let review: Review | null = null;
  let comments: Comment[] = [];
  let categories: Category[] = [];

  try {
    const [fetchedReview, fetchedComments, fetchedCategories] = await Promise.all([
      getReviewBySlug(params.slug),
      getReviewComments(params.slug, 50).then(res => res.items),
      getCategories(),
    ]);
    review = fetchedReview;
    comments = fetchedComments;
    categories = fetchedCategories;

    if (review?.id) {
      incrementReviewView(review.id).catch(() => { });
    }
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
        <h1 className="text-2xl font-bold mb-4">Review Not Found</h1>
        <p className="text-slate-600 mb-6">
          The review you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link
          href="/catalog"
          className="bg-primary text-white px-6 py-2 rounded-lg font-bold"
        >
          Back to Catalog
        </Link>
      </div>
    );
  }

  const extracted = parseReviewContent(review.contentHtml, review.excerpt);

  const ratingAvg = review.ratingAvg ?? 0;
  const ratingLabel = ratingAvg > 0 ? ratingAvg.toFixed(1) : "No rating";
  const dateLabel = formatRelativeTime(review.createdAt);
  const categoryLabel = getCategoryLabel(categories, review.categoryId);
  const subCategoryLabel = getCategoryLabel(categories, review.subCategoryId);
  const authorPic = review.author.profilePicUrl ?? DEFAULT_AVATAR;
  const productImg = review.photoUrls?.[0] ?? DEFAULT_REVIEW_IMAGE;
  const authorName = review.author.displayName || review.author.username;
  const viewsLabel = formatCompactNumber(review.views ?? 0);
  const commentCountLabel = formatCompactNumber(review.commentCount ?? comments.length);
  const votesUp = review.votesUp ?? 0;

  return (
    <>
      <ReviewDetailClient reviewId={review.id} />

      <div className="w-full flex justify-center py-6 px-4 md:px-10 lg:px-20 bg-background-light dark:bg-background-dark">
        <div className="layout-content-container w-full max-w-7xl">
          {/* Breadcrumbs */}
          <nav className="flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <span className="text-slate-300">/</span>
            <Link href="/catalog" className="hover:text-primary transition-colors">Catalog</Link>
            {categoryLabel && (
              <>
                <span className="text-slate-300">/</span>
                <Link
                  href={`/catalog?categoryId=${review.categoryId}`}
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
                  href={`/catalog?categoryId=${review.categoryId}&subCategoryId=${review.subCategoryId}`}
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
                      <span className="text-slate-500 whitespace-nowrap">Posted {dateLabel}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block"></span>
                      <div className="flex items-center gap-1 text-slate-500 whitespace-nowrap">
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                        <span>{viewsLabel} views</span>
                      </div>
                    </div>

                    {/* Author Mini Profile */}
                    <div className="flex items-center gap-4 mt-2 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-700 group">
                      <Link
                        href={`/users/${encodeURIComponent(review.author.username.toLowerCase())}`}
                        className="shrink-0"
                      >
                        <div
                          className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 border border-slate-200 dark:border-slate-600"
                          style={{ backgroundImage: `url("${authorPic}")` }}
                        />
                      </Link>
                      <div className="flex flex-col">
                        <Link
                          href={`/users/${encodeURIComponent(review.author.username.toLowerCase())}`}
                          className="text-slate-900 dark:text-white font-bold text-lg hover:text-primary transition-colors"
                        >
                          {authorName}
                        </Link>
                        <span className="text-slate-500 dark:text-slate-400 text-sm">Reviewer Community Member</span>
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
                          <span className="material-symbols-outlined">add_circle</span> Pros
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
                          <span className="material-symbols-outlined">remove_circle</span> Cons
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
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-4">Gallery</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {review.photoUrls.map((url, idx) => (
                        <div
                          key={idx}
                          className="aspect-square bg-slate-100 dark:bg-slate-700 rounded-lg bg-cover bg-center border border-slate-200 dark:border-slate-600 hover:scale-[1.02] transition-transform cursor-zoom-in"
                          style={{ backgroundImage: `url("${url}")` }}
                        />
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
                  <button className="flex items-center gap-2 px-6 py-2 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary transition-all group shadow-sm">
                    <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">thumb_up</span>
                    <span className="font-bold">Helpful </span>
                    <span className="text-slate-400 font-normal">({votesUp})</span>
                  </button>
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
                  Comments <span className="text-slate-400 font-normal text-lg">({commentCountLabel})</span>
                </h3>

                {/* Inline Comment Form */}
                <div className="flex gap-4 mb-8">
                  <div
                    className="shrink-0 bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-slate-200 dark:border-slate-600"
                    style={{ backgroundImage: `url("${AVATAR_PLACEHOLDER}")` }}
                  />
                  <div className="flex-1">
                    <textarea
                      className="w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:outline-none min-h-[100px] text-slate-900 dark:text-white placeholder:text-slate-400"
                      placeholder="Share your thoughts..."
                    ></textarea>
                    <div className="flex justify-end mt-2">
                      <button className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-bold transition-colors">
                        Post Comment
                      </button>
                    </div>
                  </div>
                </div>

                {/* Comments List */}
                <div className="flex flex-col gap-8">
                  {comments.length > 0 ? comments.map((comment) => (
                    <div key={comment.id} className="flex gap-4">
                      <Link
                        href={`/users/${comment.author.username}`}
                        className="shrink-0"
                      >
                        <div
                          className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-slate-100 dark:border-slate-700"
                          style={{ backgroundImage: `url("${comment.author.profilePicUrl || DEFAULT_AVATAR}")` }}
                        />
                      </Link>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <Link
                            href={`/users/${comment.author.username}`}
                            className="font-bold text-slate-900 dark:text-white hover:text-primary transition-colors"
                          >
                            {comment.author.displayName || comment.author.username}
                          </Link>
                          <span className="text-xs text-slate-400">{formatRelativeTime(comment.createdAt)}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                          {comment.text}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <button className="text-slate-400 hover:text-primary text-xs font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">thumb_up</span> 0
                          </button>
                          <button className="text-slate-400 hover:text-primary text-xs font-medium">Reply</button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-center text-slate-400 py-8 italic">No comments yet. Be the first to comment!</p>
                  )}
                </div>
              </section>
            </main>

            {/* Sidebar */}
            <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                <h4 className="font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">info</span>
                  Product Context
                </h4>
                <div className="flex flex-col items-center py-2">
                  <div
                    className="w-40 h-40 bg-contain bg-center bg-no-repeat mb-4 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                    style={{ backgroundImage: `url("${productImg}")` }}
                  />
                  <h3 className="text-center font-bold text-slate-900 dark:text-white mb-2">{review.title}</h3>
                  <div className="flex items-center gap-1 text-primary">
                    <RatingStarsCatalog stars={buildRatingStars(review.ratingAvg)} valueText={ratingLabel} />
                  </div>
                  <Link
                    href={`/catalog?categoryId=${review.categoryId}`}
                    className="mt-4 w-full py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold text-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    View Category Items
                  </Link>
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary to-blue-600 rounded-xl shadow-md p-6 text-white text-center">
                <h4 className="font-bold text-lg mb-2">Helpful Review?</h4>
                <p className="text-blue-100 text-xs mb-4">Share it with others or bookmark it for later access.</p>
                <div className="flex gap-2">
                  <button className="flex-1 bg-white text-primary py-2 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors">SHARE</button>
                  <button className="flex-1 bg-white/20 text-white py-2 rounded-lg text-xs font-bold hover:bg-white/30 transition-colors">SAVE</button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
