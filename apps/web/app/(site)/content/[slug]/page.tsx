import ReviewDetailClient from "@/components/reviews/ReviewDetailClient";
import type { Metadata } from "next";
import { getReviewBySlug, getReviewComments } from "@/src/lib/api";
import { buildMetadata } from "@/src/lib/seo";
import {
  buildRatingStars,
  formatNumber,
  formatRelativeTime,
  pickFrom,
  FALLBACK_AVATARS,
  FALLBACK_REVIEW_IMAGES,
} from "@/src/lib/review-utils";
import type { Comment, Review } from "@/src/types";
import { allowMockFallback } from "@/src/lib/runtime";

type PageProps = {
  params: { slug: string };
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  let title = "Review";
  let description = "Read a detailed review from the community.";
  let image: string | undefined;

  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    try {
      const review = await getReviewBySlug(params.slug);
      title = review.title;
      description = review.excerpt || description;
      image = review.photoUrls?.[0];
    } catch {
      // keep defaults
    }
  }

  return buildMetadata({
    title,
    description,
    path: `/content/${params.slug}`,
    type: "article",
    image,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value?: string): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function renderStars(rating?: number): string {
  return buildRatingStars(rating)
    .map((star) => {
      if (star === "half") {
        return `<span class="material-symbols-outlined text-[20px]">star_half</span>`;
      }
      const classes =
        star === "full"
          ? "material-symbols-outlined filled text-[20px]"
          : "material-symbols-outlined text-[20px]";
      return `<span class="${classes}">star</span>`;
    })
    .join("");
}

function renderGallery(photoUrls?: string[]): string {
  const images =
    photoUrls && photoUrls.length > 0
      ? photoUrls
      : FALLBACK_REVIEW_IMAGES.slice(0, 4);
  const extra = images.length > 4 ? images.length - 4 : 0;
  const visible = images.slice(0, 4);

  return visible
    .map((url, index) => {
      const safeUrl = escapeHtml(url);
      if (index === 3 && extra > 0) {
        return `
<div class="relative aspect-square rounded-lg bg-cover bg-center cursor-pointer hover:opacity-90 transition-opacity group overflow-hidden" data-alt="Review photo" style='background-image: url("${safeUrl}");'>
<div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
<span class="text-white text-sm font-medium">+${extra} more</span>
</div>
</div>
`;
      }
      return `<div class="aspect-square rounded-lg bg-cover bg-center cursor-pointer hover:opacity-90 transition-opacity" data-alt="Review photo" style='background-image: url("${safeUrl}");'></div>`;
    })
    .join("");
}

function renderComments(comments: Comment[]): string {
  return comments
    .map((comment, index) => {
      const authorName = escapeHtml(
        comment.author.displayName ?? comment.author.username
      );
      const commentText = escapeHtml(comment.text);
      const timestamp = escapeHtml(formatRelativeTime(comment.createdAt));
      const avatarUrl =
        comment.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index);
      return `
<div class="flex gap-4">
<div class="shrink-0 bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" data-alt="Commenter avatar" style='background-image: url("${avatarUrl}");'></div>
<div class="flex-1">
<div class="flex items-center justify-between mb-1">
<div class="flex items-center gap-2">
<span class="font-bold text-slate-900 dark:text-white">${authorName}</span>
<span class="text-xs text-slate-400">${timestamp}</span>
</div>
</div>
<p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
${commentText}
</p>
<div class="flex items-center gap-4 mt-2">
<button class="text-slate-400 hover:text-primary text-xs font-medium flex items-center gap-1">
<span class="material-symbols-outlined text-[16px]">thumb_up</span> 0
</button>
<button class="text-slate-400 hover:text-primary text-xs font-medium">Reply</button>
</div>
</div>
</div>
`;
    })
    .join("");
}

function buildErrorHtml(message: string): string {
  const safeMessage = escapeHtml(message);
  return `
<div class="w-full flex justify-center py-12 px-4 md:px-10 lg:px-20">
  <div class="w-full max-w-[960px] bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
    <h1 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">Review unavailable</h1>
    <p class="text-slate-600 dark:text-slate-300 text-sm mb-4">${safeMessage}</p>
    <a class="text-primary text-sm font-bold hover:underline" href="/catalog">Back to catalog</a>
  </div>
</div>
`;
}

function buildReviewHtml(review: Review, comments: Comment[]): string {
  const title = escapeHtml(review.title);
  const ratingAvg = review.ratingAvg ?? 0;
  const ratingCount = review.ratingCount ?? 0;
  const ratingLabel = `${ratingAvg.toFixed(1)}${
    ratingCount ? ` (${formatNumber(ratingCount)})` : ""
  }`;
  const votesUp = review.votesUp ?? 0;
  const votesDown = review.votesDown ?? 0;
  const votesLabel = `Helpful (${formatNumber(votesUp)}) | ${formatNumber(
    votesDown
  )} down`;
  const authorName = escapeHtml(
    review.author.displayName ?? review.author.username
  );
  const dateLabel = escapeHtml(formatDate(review.createdAt));
  const reviewBody =
    review.contentHtml && review.contentHtml.trim().length > 0
      ? review.contentHtml
      : `<p>${escapeHtml(review.excerpt ?? "")}</p>`;
  const galleryHtml = renderGallery(review.photoUrls);
  const commentsHtml = renderComments(comments);
  const commentCount = comments.length;

  return `

<div class="w-full flex justify-center py-6 px-4 md:px-10 lg:px-20">
<div class="w-full max-w-[1280px] flex flex-col gap-6">
<!-- Breadcrumbs -->
<nav class="flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
<a class="hover:text-primary transition-colors" href="/">Home</a>
<span>/</span>
<a class="hover:text-primary transition-colors" href="/catalog">Electronics</a>
<span>/</span>
<a class="hover:text-primary transition-colors" href="/catalog/reviews/1">Smartphones</a>
<span>/</span>
<span class="text-slate-900 dark:text-white font-medium">${title}</span>
</nav>
<div class="flex flex-col lg:flex-row gap-8 items-start">
<!-- Main Content Area (Left Column) -->
<main class="flex-1 w-full min-w-0 flex flex-col gap-6">
<!-- Review Card Container -->
<article class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden" data-review-id="${escapeHtml(
    review.id
  )}">
<!-- Review Header -->
<div class="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
<div class="flex flex-col gap-4">
<h1 class="text-slate-900 dark:text-white text-3xl md:text-4xl font-extrabold leading-tight tracking-tight">
${title}
</h1>
<div class="flex flex-wrap items-center gap-4 text-sm">
<div class="flex items-center text-yellow-400">
${renderStars(review.ratingAvg)}
<span class="ml-2 text-slate-700 dark:text-slate-300 font-bold text-base">${escapeHtml(
    ratingLabel
  )}</span>
</div>
<span class="w-1 h-1 rounded-full bg-slate-300"></span>
<span class="text-slate-500">${dateLabel}</span>
<span class="w-1 h-1 rounded-full bg-slate-300"></span>
<div class="flex items-center gap-1 text-slate-500">
<span class="material-symbols-outlined text-[16px]">visibility</span>
<span>12.5k views</span>
</div>
</div>
<!-- Author Bio Mini -->
<div class="flex items-center gap-4 mt-2 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-700">
<div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12" data-alt="Reviewer profile picture" style='background-image: url("/stitch_assets/images/img-042.png");'></div>
<div class="flex flex-col">
<div class="flex items-center gap-2">
<span class="text-slate-900 dark:text-white font-bold text-lg">${authorName}</span>
<span class="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full border border-primary/20">Expert Reviewer</span>
</div>
<span class="text-slate-500 dark:text-slate-400 text-sm">Reputation: 1,540 | 142 Reviews</span>
</div>
</div>
</div>
</div>
<!-- Pros & Cons -->
<div class="grid grid-cols-1 md:grid-cols-2 border-b border-slate-100 dark:border-slate-700">
<div class="p-6 md:p-8 bg-green-50/50 dark:bg-green-900/10 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700">
<h3 class="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold mb-3">
<span class="material-symbols-outlined">add_circle</span> Pros
                                </h3>
<ul class="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 text-sm md:text-base marker:text-green-500">
<li>Exceptional camera performance in low light</li>
<li>Significantly lighter titanium build</li>
<li>USB-C port finally adds convenience</li>
<li>Dynamic Island is surprisingly useful</li>
</ul>
</div>
<div class="p-6 md:p-8 bg-red-50/50 dark:bg-red-900/10">
<h3 class="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold mb-3">
<span class="material-symbols-outlined">do_not_disturb_on</span> Cons
                                </h3>
<ul class="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 text-sm md:text-base marker:text-red-500">
<li>Still stuck with a 60Hz screen refresh rate</li>
<li>Charging speeds haven't improved much</li>
<li>No telephoto lens on the base model</li>
</ul>
</div>
</div>
<!-- Photo Gallery -->
<div class="p-6 md:p-8 pb-0">
<h3 class="text-slate-900 dark:text-white font-bold text-lg mb-4">Gallery</h3>
<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
${galleryHtml}
</div>
</div>
<!-- Review Body -->
<div class="p-6 md:p-8 prose dark:prose-invert prose-slate max-w-none">
${reviewBody}
</div>
<!-- Engagement Bar -->
<div class="p-4 md:p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
<div class="flex items-center gap-4">
<button class="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary transition-all group" data-review-vote data-vote-type="up">
<span class="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">thumb_up</span>
<span class="font-medium">${escapeHtml(votesLabel)}</span>
</button>
<button class="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary transition-all">
<span class="material-symbols-outlined text-[20px]">share</span>
<span class="font-medium">Share</span>
</button>
</div>
<div class="text-slate-500 dark:text-slate-400 text-sm font-medium">
                                Posted in <a class="text-primary hover:underline" href="/catalog/reviews/1">Smartphones</a>
</div>
</div>
</article>
<!-- Comments Section -->
<section class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
<h3 class="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            Comments <span class="text-slate-400 font-normal text-lg">(${commentCount})</span>
</h3>
<!-- Comment Input -->
<div class="flex gap-4 mb-8">
<div class="shrink-0 bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" data-alt="Current user avatar" style='background-image: url("/stitch_assets/images/img-047.png");'></div>
<div class="flex-1">
<textarea class="w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent min-h-[100px] text-slate-900 dark:text-white placeholder:text-slate-400" placeholder="Join the discussion..." data-comment-text></textarea>
<div class="flex justify-end mt-2">
<button class="bg-primary hover:bg-blue-600 text-white px-5 py-2 rounded-lg font-medium transition-colors" data-comment-submit>Post Comment</button>
</div>
</div>
</div>
<!-- Comment List -->
<div class="flex flex-col gap-6">
${commentsHtml}
</div>
</section>
</main>
<!-- Right Sidebar -->
<aside class="w-full lg:w-80 shrink-0 flex flex-col gap-6">
<!-- Product Info Card -->
<div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
<h4 class="font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Product Details</h4>
<div class="flex flex-col items-center mb-4">
<div class="w-32 h-32 bg-contain bg-center bg-no-repeat mb-3" data-alt="iPhone 15 product official image" style='background-image: url("/stitch_assets/images/img-051.png");'></div>
<h3 class="text-center font-bold text-slate-900 dark:text-white">Apple iPhone 15</h3>
<p class="text-center text-sm text-slate-500 mb-2">128GB - Blue</p>
<div class="flex items-center gap-1 text-yellow-400 text-sm mb-3">
<span class="material-symbols-outlined filled text-[18px]">star</span>
<span class="text-slate-700 dark:text-slate-300 font-bold ml-1">4.7</span>
<span class="text-slate-400 font-normal">(2,103 reviews)</span>
</div>
<button class="w-full bg-primary hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors shadow-sm shadow-blue-200 dark:shadow-none">
                                View Product Specs
                            </button>
</div>
</div>
<!-- Related Reviews -->
<div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 sticky top-24">
<h4 class="font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
<span>More Reviews</span>
<a class="text-xs text-primary font-medium hover:underline" href="/catalog">View All</a>
</h4>
<div class="flex flex-col gap-4">
<!-- Sidebar Item 1 -->
<a class="flex gap-3 group" href="/content/iphone-15-pro-max-review">
<div class="w-16 h-16 shrink-0 rounded-lg bg-cover bg-center" data-alt="Review thumbnail showing pink iPhone" style='background-image: url("/stitch_assets/images/img-052.png");'></div>
<div class="flex flex-col">
<h5 class="text-sm font-medium text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors line-clamp-2">Why I switched to Pink: iPhone 15 color review</h5>
<div class="flex items-center gap-1 mt-1">
<span class="material-symbols-outlined filled text-[14px] text-yellow-400">star</span>
<span class="text-xs text-slate-500">5.0</span>
</div>
</div>
</a>
<!-- Sidebar Item 2 -->
<a class="flex gap-3 group" href="/content/samsung-galaxy-s24-ultra-review">
<div class="w-16 h-16 shrink-0 rounded-lg bg-cover bg-center" data-alt="Review thumbnail showing black iPhone" style='background-image: url("/stitch_assets/images/img-053.png");'></div>
<div class="flex flex-col">
<h5 class="text-sm font-medium text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors line-clamp-2">1 Month Later: Is the battery really that bad?</h5>
<div class="flex items-center gap-1 mt-1">
<span class="material-symbols-outlined filled text-[14px] text-yellow-400">star</span>
<span class="text-xs text-slate-500">3.5</span>
</div>
</div>
</a>
<!-- Sidebar Item 3 -->
<a class="flex gap-3 group" href="/content/sony-wh-1000xm5-review">
<div class="w-16 h-16 shrink-0 rounded-lg bg-cover bg-center" data-alt="Review thumbnail showing android phone" style='background-image: url("/stitch_assets/images/img-054.png");'></div>
<div class="flex flex-col">
<h5 class="text-sm font-medium text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors line-clamp-2">Samsung S24 vs iPhone 15: The ultimate showdown</h5>
<div class="flex items-center gap-1 mt-1">
<span class="material-symbols-outlined filled text-[14px] text-yellow-400">star</span>
<span class="text-xs text-slate-500">4.0</span>
</div>
</div>
</a>
</div>
<div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
<h4 class="font-bold text-slate-900 dark:text-white mb-3 text-sm">Popular in Electronics</h4>
<div class="flex flex-wrap gap-2">
<span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2 py-1 rounded cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">AirPods Pro</span>
<span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2 py-1 rounded cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Sony WH-1000XM5</span>
<span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2 py-1 rounded cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">iPad Air</span>
</div>
</div>
</div>
</aside>
</div>
</div>
</div>

`;
}

const fallbackBodyHtml = `

<div class="w-full flex justify-center py-6 px-4 md:px-10 lg:px-20">
<div class="w-full max-w-[1280px] flex flex-col gap-6">
<!-- Breadcrumbs -->
<nav class="flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
<a class="hover:text-primary transition-colors" href="/">Home</a>
<span>/</span>
<a class="hover:text-primary transition-colors" href="/catalog">Electronics</a>
<span>/</span>
<a class="hover:text-primary transition-colors" href="/catalog/reviews/1">Smartphones</a>
<span>/</span>
<span class="text-slate-900 dark:text-white font-medium">Apple iPhone 15</span>
</nav>
<div class="flex flex-col lg:flex-row gap-8 items-start">
<!-- Main Content Area (Left Column) -->
<main class="flex-1 w-full min-w-0 flex flex-col gap-6">
<!-- Review Card Container -->
<article class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
<!-- Review Header -->
<div class="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
<div class="flex flex-col gap-4">
<h1 class="text-slate-900 dark:text-white text-3xl md:text-4xl font-extrabold leading-tight tracking-tight">
                                    Is the iPhone 15 worth the upgrade? My honest 3-month experience.
                                </h1>
<div class="flex flex-wrap items-center gap-4 text-sm">
<div class="flex items-center text-yellow-400">
<span class="material-symbols-outlined filled text-[20px]">star</span>
<span class="material-symbols-outlined filled text-[20px]">star</span>
<span class="material-symbols-outlined filled text-[20px]">star</span>
<span class="material-symbols-outlined filled text-[20px]">star</span>
<span class="material-symbols-outlined text-[20px]">star_half</span>
<span class="ml-2 text-slate-700 dark:text-slate-300 font-bold text-base">4.5</span>
</div>
<span class="w-1 h-1 rounded-full bg-slate-300"></span>
<span class="text-slate-500">Oct 12, 2023</span>
<span class="w-1 h-1 rounded-full bg-slate-300"></span>
<div class="flex items-center gap-1 text-slate-500">
<span class="material-symbols-outlined text-[16px]">visibility</span>
<span>12.5k views</span>
</div>
</div>
<!-- Author Bio Mini -->
<div class="flex items-center gap-4 mt-2 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-700">
<div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12" data-alt="Reviewer profile picture" style='background-image: url("/stitch_assets/images/img-042.png");'></div>
<div class="flex flex-col">
<div class="flex items-center gap-2">
<span class="text-slate-900 dark:text-white font-bold text-lg">TechGuru99</span>
<span class="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full border border-primary/20">Expert Reviewer</span>
</div>
<span class="text-slate-500 dark:text-slate-400 text-sm">Reputation: 1,540 | 142 Reviews</span>
</div>
</div>
</div>
</div>
<!-- Pros & Cons -->
<div class="grid grid-cols-1 md:grid-cols-2 border-b border-slate-100 dark:border-slate-700">
<div class="p-6 md:p-8 bg-green-50/50 dark:bg-green-900/10 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700">
<h3 class="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold mb-3">
<span class="material-symbols-outlined">add_circle</span> Pros
                                </h3>
<ul class="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 text-sm md:text-base marker:text-green-500">
<li>Exceptional camera performance in low light</li>
<li>Significantly lighter titanium build</li>
<li>USB-C port finally adds convenience</li>
<li>Dynamic Island is surprisingly useful</li>
</ul>
</div>
<div class="p-6 md:p-8 bg-red-50/50 dark:bg-red-900/10">
<h3 class="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold mb-3">
<span class="material-symbols-outlined">do_not_disturb_on</span> Cons
                                </h3>
<ul class="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 text-sm md:text-base marker:text-red-500">
<li>Still stuck with a 60Hz screen refresh rate</li>
<li>Charging speeds haven't improved much</li>
<li>No telephoto lens on the base model</li>
</ul>
</div>
</div>
<!-- Photo Gallery -->
<div class="p-6 md:p-8 pb-0">
<h3 class="text-slate-900 dark:text-white font-bold text-lg mb-4">Gallery</h3>
<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
<div class="aspect-square rounded-lg bg-cover bg-center cursor-pointer hover:opacity-90 transition-opacity" data-alt="iPhone 15 back view blue color" style='background-image: url("/stitch_assets/images/img-043.png");'></div>
<div class="aspect-square rounded-lg bg-cover bg-center cursor-pointer hover:opacity-90 transition-opacity" data-alt="iPhone 15 screen display closeup" style='background-image: url("/stitch_assets/images/img-044.png");'></div>
<div class="aspect-square rounded-lg bg-cover bg-center cursor-pointer hover:opacity-90 transition-opacity" data-alt="Camera lens detail shot" style='background-image: url("/stitch_assets/images/img-045.png");'></div>
<div class="relative aspect-square rounded-lg bg-cover bg-center cursor-pointer hover:opacity-90 transition-opacity group overflow-hidden" data-alt="iPhone holding in hand" style='background-image: url("/stitch_assets/images/img-046.png");'>
<div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
<span class="text-white text-sm font-medium">+3 more</span>
</div>
</div>
</div>
</div>
<!-- Review Body -->
<div class="p-6 md:p-8 prose dark:prose-invert prose-slate max-w-none">
<h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3">Design &amp; Build Quality</h3>
<p class="text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                                The first thing you notice when picking up the iPhone 15 is the contoured edges. Unlike the sharp edges of the iPhone 12 through 14, this feels much softer in the hand. The color-infused back glass has a matte finish that does a fantastic job of hiding fingerprints, which has always been a pet peeve of mine with glossy phones.
                            </p>
<h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3">Camera Performance</h3>
<p class="text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                                Apple finally bumped the main sensor to 48MP, and it shows. The default 24MP photos are crisp, with excellent dynamic range. I took this phone on a weekend trip to the mountains, and the landscape shots were breathtaking. The new "2x optical-quality zoom" (which is really just a crop of the sensor) is genuinely usable for portraits.
                            </p>
<h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3">Battery Life &amp; Charging</h3>
<p class="text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                                Here is where things get a bit mixed. While the battery easily lasts a full day of moderate use (about 6-7 hours of screen-on time for me), the charging speeds are still disappointing compared to Android competitors. It takes over 30 minutes to get to 50%, which feels sluggish in 2024. However, the convenience of USB-C cannot be overstated—I can finally travel with just one cable for my Mac, iPad, and iPhone.
                            </p>
<div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 my-6">
<p class="text-blue-800 dark:text-blue-200 font-medium text-center">
                                    "If you are coming from an iPhone 11 or 12, this is a massive leap forward. If you have a 13 or 14, you might want to wait."
                                </p>
</div>
<p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                                Overall, the iPhone 15 is the most well-rounded base model iPhone Apple has released in years. It borrows just enough "Pro" features (Dynamic Island, 48MP camera) to feel fresh, without the Pro price tag.
                            </p>
</div>
<!-- Engagement Bar -->
<div class="p-4 md:p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
<div class="flex items-center gap-4">
<button class="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary transition-all group">
<span class="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">thumb_up</span>
<span class="font-medium">Helpful (342)</span>
</button>
<button class="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary transition-all">
<span class="material-symbols-outlined text-[20px]">share</span>
<span class="font-medium">Share</span>
</button>
</div>
<div class="text-slate-500 dark:text-slate-400 text-sm font-medium">
                                Posted in <a class="text-primary hover:underline" href="/catalog/reviews/1">Smartphones</a>
</div>
</div>
</article>
<!-- Comments Section -->
<section class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
<h3 class="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            Comments <span class="text-slate-400 font-normal text-lg">(24)</span>
</h3>
<!-- Comment Input -->
<div class="flex gap-4 mb-8">
<div class="shrink-0 bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" data-alt="Current user avatar" style='background-image: url("/stitch_assets/images/img-047.png");'></div>
<div class="flex-1">
<textarea class="w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent min-h-[100px] text-slate-900 dark:text-white placeholder:text-slate-400" placeholder="Join the discussion..."></textarea>
<div class="flex justify-end mt-2">
<button class="bg-primary hover:bg-blue-600 text-white px-5 py-2 rounded-lg font-medium transition-colors">Post Comment</button>
</div>
</div>
</div>
<!-- Comment List -->
<div class="flex flex-col gap-6">
<!-- Comment 1 -->
<div class="flex gap-4">
<div class="shrink-0 bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" data-alt="Commenter avatar 1" style='background-image: url("/stitch_assets/images/img-048.png");'></div>
<div class="flex-1">
<div class="flex items-center justify-between mb-1">
<div class="flex items-center gap-2">
<span class="font-bold text-slate-900 dark:text-white">AlexM</span>
<span class="text-xs text-slate-400">2 hours ago</span>
</div>
</div>
<p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        Great review! I was on the fence about the 60Hz screen, but you're right, for most people coming from older phones it won't matter much.
                                    </p>
<div class="flex items-center gap-4 mt-2">
<button class="text-slate-400 hover:text-primary text-xs font-medium flex items-center gap-1">
<span class="material-symbols-outlined text-[16px]">thumb_up</span> 12
                                        </button>
<button class="text-slate-400 hover:text-primary text-xs font-medium">Reply</button>
</div>
</div>
</div>
<!-- Comment 2 -->
<div class="flex gap-4">
<div class="shrink-0 bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" data-alt="Commenter avatar 2" style='background-image: url("/stitch_assets/images/img-049.png");'></div>
<div class="flex-1">
<div class="flex items-center justify-between mb-1">
<div class="flex items-center gap-2">
<span class="font-bold text-slate-900 dark:text-white">SarahJ_Tech</span>
<span class="text-xs text-slate-400">5 hours ago</span>
</div>
</div>
<p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        I disagree about the charging speed. It's actually quite slow compared to my OnePlus. Apple really needs to step up their game there.
                                    </p>
<div class="flex items-center gap-4 mt-2">
<button class="text-slate-400 hover:text-primary text-xs font-medium flex items-center gap-1">
<span class="material-symbols-outlined text-[16px]">thumb_up</span> 5
                                        </button>
<button class="text-slate-400 hover:text-primary text-xs font-medium">Reply</button>
</div>
<!-- Nested Reply -->
<div class="flex gap-4 mt-4 ml-4 pl-4 border-l-2 border-slate-100 dark:border-slate-700">
<div class="shrink-0 bg-center bg-no-repeat aspect-square bg-cover rounded-full size-8" data-alt="Author avatar small" style='background-image: url("/stitch_assets/images/img-050.png");'></div>
<div class="flex-1">
<div class="flex items-center gap-2 mb-1">
<span class="font-bold text-slate-900 dark:text-white text-sm">TechGuru99</span>
<span class="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded">Author</span>
</div>
<p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                                Fair point, Sarah! OnePlus definitely wins on charging. It's a trade-off for the ecosystem integration I suppose.
                                            </p>
</div>
</div>
</div>
</div>
</div>
</section>
</main>
<!-- Right Sidebar -->
<aside class="w-full lg:w-80 shrink-0 flex flex-col gap-6">
<!-- Product Info Card -->
<div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
<h4 class="font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Product Details</h4>
<div class="flex flex-col items-center mb-4">
<div class="w-32 h-32 bg-contain bg-center bg-no-repeat mb-3" data-alt="iPhone 15 product official image" style='background-image: url("/stitch_assets/images/img-051.png");'></div>
<h3 class="text-center font-bold text-slate-900 dark:text-white">Apple iPhone 15</h3>
<p class="text-center text-sm text-slate-500 mb-2">128GB - Blue</p>
<div class="flex items-center gap-1 text-yellow-400 text-sm mb-3">
<span class="material-symbols-outlined filled text-[18px]">star</span>
<span class="text-slate-700 dark:text-slate-300 font-bold ml-1">4.7</span>
<span class="text-slate-400 font-normal">(2,103 reviews)</span>
</div>
<button class="w-full bg-primary hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors shadow-sm shadow-blue-200 dark:shadow-none">
                                View Product Specs
                            </button>
</div>
</div>
<!-- Related Reviews -->
<div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 sticky top-24">
<h4 class="font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
<span>More Reviews</span>
<a class="text-xs text-primary font-medium hover:underline" href="/catalog">View All</a>
</h4>
<div class="flex flex-col gap-4">
<!-- Sidebar Item 1 -->
<a class="flex gap-3 group" href="/content/iphone-15-pro-max-review">
<div class="w-16 h-16 shrink-0 rounded-lg bg-cover bg-center" data-alt="Review thumbnail showing pink iPhone" style='background-image: url("/stitch_assets/images/img-052.png");'></div>
<div class="flex flex-col">
<h5 class="text-sm font-medium text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors line-clamp-2">Why I switched to Pink: iPhone 15 color review</h5>
<div class="flex items-center gap-1 mt-1">
<span class="material-symbols-outlined filled text-[14px] text-yellow-400">star</span>
<span class="text-xs text-slate-500">5.0</span>
</div>
</div>
</a>
<!-- Sidebar Item 2 -->
<a class="flex gap-3 group" href="/content/samsung-galaxy-s24-ultra-review">
<div class="w-16 h-16 shrink-0 rounded-lg bg-cover bg-center" data-alt="Review thumbnail showing black iPhone" style='background-image: url("/stitch_assets/images/img-053.png");'></div>
<div class="flex flex-col">
<h5 class="text-sm font-medium text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors line-clamp-2">1 Month Later: Is the battery really that bad?</h5>
<div class="flex items-center gap-1 mt-1">
<span class="material-symbols-outlined filled text-[14px] text-yellow-400">star</span>
<span class="text-xs text-slate-500">3.5</span>
</div>
</div>
</a>
<!-- Sidebar Item 3 -->
<a class="flex gap-3 group" href="/content/sony-wh-1000xm5-review">
<div class="w-16 h-16 shrink-0 rounded-lg bg-cover bg-center" data-alt="Review thumbnail showing android phone" style='background-image: url("/stitch_assets/images/img-054.png");'></div>
<div class="flex flex-col">
<h5 class="text-sm font-medium text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors line-clamp-2">Samsung S24 vs iPhone 15: The ultimate showdown</h5>
<div class="flex items-center gap-1 mt-1">
<span class="material-symbols-outlined filled text-[14px] text-yellow-400">star</span>
<span class="text-xs text-slate-500">4.0</span>
</div>
</div>
</a>
</div>
<div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
<h4 class="font-bold text-slate-900 dark:text-white mb-3 text-sm">Popular in Electronics</h4>
<div class="flex flex-wrap gap-2">
<span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2 py-1 rounded cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">AirPods Pro</span>
<span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2 py-1 rounded cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Sony WH-1000XM5</span>
<span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2 py-1 rounded cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">iPad Air</span>
</div>
</div>
</div>
</aside>
</div>
</div>
</div>

`;

export default async function Page({ params }: PageProps) {
  const apiConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
  let review: Review | null = null;
  let comments: Comment[] = [];
  let errorMessage: string | null = null;

  if (apiConfigured) {
    try {
      review = await getReviewBySlug(params.slug);
      if (review) {
        const commentResult = await getReviewComments(review.id, 10);
        comments = commentResult.items;
      }
    } catch {
      review = null;
      if (!allowMockFallback) {
        errorMessage = "Unable to load this review. Please try again later.";
      }
    }
  } else if (!allowMockFallback) {
    errorMessage = "API base URL is not configured.";
  }

  const bodyHtml = review
    ? buildReviewHtml(review, comments)
    : allowMockFallback
      ? fallbackBodyHtml
      : buildErrorHtml(errorMessage ?? "Review is unavailable.");

  return (
    <>
      <ReviewDetailClient />
      <div
        className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display"
        data-page="individual-review"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </>
  );
}
