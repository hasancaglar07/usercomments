import Link from "next/link";
import {
  RatingStarsCatalog,
  RatingStarsCategory,
  RatingStarsHomepage,
  RatingStarsProfile,
} from "@/components/ui/RatingStars";
import type { Review, StarType } from "@/src/types";
import { t } from "@/src/lib/copy";
import type { SupportedLanguage } from "@/src/lib/i18n";

type HomepageBadge = "verified" | "expert" | null;

export type ReviewCardHomepageData = {
  review: Review;
  href: string;
  authorMeta: string;
  postedLabel: string;
  ratingStars: StarType[];
  ratingValue: string;
  imageUrl: string;
  imageAlt: string;
  avatarUrl: string;
  avatarAlt: string;
  badge: HomepageBadge;
  likesLabel: string;
  commentsLabel: string;
  photoCountLabel?: string;
};

import { getOptimizedImageUrl } from "@/src/lib/image-optimization";

type ReviewCardHomepageProps = ReviewCardHomepageData & {
  lang: SupportedLanguage;
  imagePriority?: boolean;
};

export function ReviewCardHomepage({
  review,
  href,
  authorMeta,
  postedLabel,
  ratingStars,
  ratingValue,
  imageUrl,
  imageAlt,
  avatarUrl,
  avatarAlt,
  badge,
  likesLabel,
  commentsLabel,
  photoCountLabel,
  lang,
  imagePriority = false,
}: ReviewCardHomepageProps) {
  const authorName = review.author.displayName ?? review.author.username;
  const optimizedImageUrl = getOptimizedImageUrl(imageUrl, 600);
  const optimizedAvatarUrl = getOptimizedImageUrl(avatarUrl, 100);

  return (
    <article className="flex flex-col sm:flex-row bg-background-light dark:bg-surface-dark rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow">
      <div className="w-full sm:w-48 h-48 sm:h-auto flex-shrink-0 relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={imageAlt}
          className="h-full w-full object-cover"
          data-alt={imageAlt}
          decoding="async"
          fetchPriority={imagePriority ? "high" : "auto"}
          loading={imagePriority ? "eager" : "lazy"}
          src={optimizedImageUrl}
        />
      </div>
      <div className="flex-1 p-5 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={avatarAlt}
                  className="h-full w-full object-cover"
                  data-alt={avatarAlt}
                  decoding="async"
                  loading="lazy"
                  src={optimizedAvatarUrl}
                />
              </div>
              <div>
                <p className="text-xs font-bold text-text-main dark:text-white">
                  {authorName}
                </p>
                <p className="text-[10px] text-text-muted">{authorMeta}</p>
              </div>
            </div>
            {badge === "verified" ? (
              <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-medium">
                {t(lang, "reviewCard.verifiedPurchase")}
              </span>
            ) : null}
            {badge === "expert" ? (
              <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-medium">
                {t(lang, "reviewCard.expert")}
              </span>
            ) : null}
          </div>
          <h3 className="text-lg font-bold text-text-main dark:text-white hover:text-primary cursor-pointer mb-1">
            <Link
              className="hover:underline decoration-primary"
              href={href}
              prefetch={false}
            >
              {review.title}
            </Link>
          </h3>
          <RatingStarsHomepage stars={ratingStars} valueText={ratingValue} />
          <p className="text-sm text-text-muted line-clamp-2">
            {review.excerpt}
          </p>
        </div>
        <div className="flex items-center justify-between mt-4 border-t border-gray-100 dark:border-gray-700 pt-3">
          <span className="text-xs text-gray-400">{postedLabel}</span>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 text-gray-500 hover:text-primary transition-colors text-xs">
              <span className="material-symbols-outlined text-[16px]">
                thumb_up
              </span>
              <span>{likesLabel}</span>
            </button>
            <button className="flex items-center gap-1 text-gray-500 hover:text-primary transition-colors text-xs">
              <span className="material-symbols-outlined text-[16px]">
                comment
              </span>
              <span>{commentsLabel}</span>
            </button>
            {photoCountLabel ? (
              <span className="text-xs text-gray-400">{photoCountLabel}</span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export type CatalogCategoryMeta = {
  icon: string;
  label: string;
  className: string;
};

export type ReviewCardCatalogData = {
  review: Review;
  href: string;
  dateLabel: string;
  ratingStars: StarType[];
  ratingValue: string;
  imageUrl: string;
  imageAlt: string;
  authorAvatarAlt: string;
  authorAvatarDataAlt: string;
  authorAvatarUrl: string;
  category: CatalogCategoryMeta;
  viewsLabel: string;
  likesLabel: string;
  showImageOverlay: boolean;
  photoCountLabel?: string;
};

export function ReviewCardCatalog({
  review,
  href,
  dateLabel,
  ratingStars,
  ratingValue,
  imageUrl,
  imageAlt,
  authorAvatarAlt,
  authorAvatarDataAlt,
  authorAvatarUrl,
  category,
  viewsLabel,
  likesLabel,
  showImageOverlay,
  photoCountLabel,
}: ReviewCardCatalogData) {
  const authorName = review.author.displayName ?? review.author.username;
  const optimizedImageUrl = getOptimizedImageUrl(imageUrl, 600);
  const optimizedAvatarUrl = getOptimizedImageUrl(authorAvatarUrl, 100);

  return (
    <article className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6 sm:flex gap-6">
        <div className="sm:w-48 sm:shrink-0 mb-4 sm:mb-0">
          <div
            className="aspect-video sm:aspect-[4/3] w-full bg-slate-100 rounded-lg bg-cover bg-center relative overflow-hidden group"
            data-alt={imageAlt}
            style={{ backgroundImage: `url(${optimizedImageUrl})` }}
          >
            {showImageOverlay ? (
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            ) : null}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            className={`flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider ${category.className}`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {category.icon}
            </span>{" "}
            {category.label}
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight group-hover:text-primary transition-colors cursor-pointer">
            <Link
              className="hover:underline"
              href={href}
              prefetch={false}
            >
              {review.title}
            </Link>
          </h3>
          <RatingStarsCatalog stars={ratingStars} valueText={ratingValue} />
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-2">
            {review.excerpt}
          </p>
          <div className="mt-auto flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-4">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={authorAvatarAlt}
                className="w-6 h-6 rounded-full"
                data-alt={authorAvatarDataAlt}
                src={optimizedAvatarUrl}
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {authorName}
              </span>
              <span className="mx-1 text-slate-300">•</span>
              <span className="text-xs text-slate-500">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400 text-xs font-medium">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">
                  visibility
                </span>{" "}
                {viewsLabel}
              </div>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">
                  thumb_up
                </span>{" "}
                {likesLabel}
              </div>
              {photoCountLabel ? (
                <div className="flex items-center gap-1">{photoCountLabel}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export type ReviewCardCategoryData = {
  review: Review;
  href: string;
  dateLabel: string;
  ratingStars: StarType[];
  imageUrl: string;
  imageAlt: string;
  avatarUrl: string;
  avatarAlt: string;
  tagLabel: string;
  likesLabel: string;
  commentsLabel: string;
  photoCountLabel?: string;
};

export function ReviewCardCategory({
  review,
  href,
  dateLabel,
  ratingStars,
  imageUrl,
  imageAlt,
  avatarUrl,
  avatarAlt,
  tagLabel,
  likesLabel,
  commentsLabel,
  photoCountLabel,
}: ReviewCardCategoryData) {
  const authorName = review.author.displayName ?? review.author.username;
  const optimizedImageUrl = getOptimizedImageUrl(imageUrl, 600);
  const optimizedAvatarUrl = getOptimizedImageUrl(avatarUrl, 100);

  return (
    <article className="flex flex-col md:flex-row gap-5 bg-white p-5 rounded-xl shadow-sm border border-[#e7edf3] hover:shadow-md transition-shadow">
      <div className="w-full md:w-48 shrink-0">
        <div
          className="aspect-[4/3] md:aspect-square w-full rounded-lg bg-cover bg-center border border-[#e7edf3]"
          data-alt={imageAlt}
          style={{ backgroundImage: `url(${optimizedImageUrl})` }}
        />
      </div>
      <div className="flex flex-col flex-1 gap-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div
              className="size-6 rounded-full bg-gray-200 bg-cover bg-center"
              data-alt={avatarAlt}
              style={{ backgroundImage: `url(${optimizedAvatarUrl})` }}
            />
            <span className="text-xs font-semibold text-[#4c739a]">
              {authorName}
            </span>
            <span className="text-xs text-gray-400">• {dateLabel}</span>
          </div>
          <RatingStarsCategory stars={ratingStars} />
        </div>
        <h3 className="text-lg font-bold text-[#0d141b] group-hover:text-primary cursor-pointer hover:underline decoration-primary">
          <Link href={href} prefetch={false}>
            {review.title}
          </Link>
        </h3>
        <p className="text-[#4c739a] text-sm line-clamp-3 leading-relaxed">
          {review.excerpt}
        </p>
        <div className="mt-auto pt-3 flex items-center gap-4 border-t border-[#e7edf3]">
          <span className="text-xs font-bold text-[#0d141b] bg-[#e7edf3] px-2 py-1 rounded">
            {tagLabel}
          </span>
          {photoCountLabel ? (
            <span className="text-xs font-medium text-[#4c739a]">
              {photoCountLabel}
            </span>
          ) : null}
          <div className="flex items-center gap-1 text-[#4c739a] ml-auto">
            <span className="material-symbols-outlined text-[16px]">
              thumb_up
            </span>
            <span className="text-xs font-medium">{likesLabel}</span>
          </div>
          <div className="flex items-center gap-1 text-[#4c739a]">
            <span className="material-symbols-outlined text-[16px]">
              chat_bubble
            </span>
            <span className="text-xs font-medium">{commentsLabel}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export type ReviewCardProfileData = {
  review: Review;
  href: string;
  dateLabel: string;
  ratingStars: StarType[];
  imageUrl: string;
  imageAlt: string;
  tagLabel: string;
  likesLabel: string;
  commentsLabel: string;
  photoCountLabel?: string;
};

export type ReviewCardProfileActions = {
  onReport?: (target: {
    reviewId: string;
    reviewSlug: string;
    reviewTitle: string;
  }) => void;
  onVote?: (reviewId: string) => void;
  onComment?: (reviewSlug: string) => void;
  onShare?: (reviewSlug: string, reviewTitle: string) => void;
};

type ReviewCardProfileProps = ReviewCardProfileData &
  ReviewCardProfileActions & {
    lang: SupportedLanguage;
  };

export function ReviewCardProfile({
  review,
  href,
  dateLabel,
  ratingStars,
  imageUrl,
  imageAlt,
  tagLabel,
  likesLabel,
  commentsLabel,
  photoCountLabel,
  onReport,
  onVote,
  onComment,
  onShare,
  lang,
}: ReviewCardProfileProps) {
  const optimizedImageUrl = getOptimizedImageUrl(imageUrl, 600);

  return (
    <article
      className="flex flex-col bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 shadow-sm hover:shadow-md transition-shadow"
      data-review-id={review.id}
      data-review-slug={review.slug}
      data-review-title={review.title}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <RatingStarsProfile stars={ratingStars} />
          <span className="text-text-sub-light dark:text-text-sub-dark text-sm">
            • {dateLabel}
          </span>
        </div>
        <button
          className="text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark"
          type="button"
          data-review-report
          onClick={() =>
            onReport?.({
              reviewId: review.id,
              reviewSlug: review.slug,
              reviewTitle: review.title,
            })
          }
        >
          <span className="material-symbols-outlined text-[20px]">
            more_vert
          </span>
        </button>
      </div>
      <div className="flex gap-4 sm:gap-6 flex-col sm:flex-row">
        <div
          className="w-full sm:w-32 h-48 sm:h-32 rounded-lg bg-cover bg-center shrink-0 border border-border-light dark:border-border-dark"
          data-alt={imageAlt}
          style={{ backgroundImage: `url(${optimizedImageUrl})` }}
        />
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-background-light dark:bg-background-dark text-[10px] font-bold uppercase tracking-wider text-text-sub-light dark:text-text-sub-dark border border-border-light dark:border-border-dark">
              {tagLabel}
            </span>
          </div>
          <h2 className="text-xl font-bold text-text-main-light dark:text-text-main-dark mb-2 hover:text-primary transition-colors">
          <Link href={href} prefetch={false}>
            {review.title}
          </Link>
          </h2>
          <p className="text-text-sub-light dark:text-text-sub-dark text-sm line-clamp-3 mb-4 leading-relaxed">
            {review.excerpt}
          </p>
          <Link
            className="text-primary text-sm font-bold hover:underline mb-4 inline-block"
            href={href}
            prefetch={false}
          >
            {t(lang, "reviewCard.readFullReview")}
          </Link>
          <div className="mt-auto flex items-center justify-between pt-4 border-t border-border-light dark:border-border-dark">
            <div className="flex gap-4">
              <button
                className="flex items-center gap-1.5 text-text-sub-light dark:text-text-sub-dark hover:text-primary transition-colors text-sm font-medium"
                type="button"
                data-review-vote
                onClick={() => onVote?.(review.id)}
              >
                <span className="material-symbols-outlined text-[18px]">
                  thumb_up
                </span>
                <span>{likesLabel}</span>
              </button>
              <button
                className="flex items-center gap-1.5 text-text-sub-light dark:text-text-sub-dark hover:text-primary transition-colors text-sm font-medium"
                type="button"
                data-review-comment
                onClick={() => onComment?.(review.slug)}
              >
                <span className="material-symbols-outlined text-[18px]">
                  chat_bubble
                </span>
                <span>{commentsLabel}</span>
              </button>
              {photoCountLabel ? (
                <span className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">
                  {photoCountLabel}
                </span>
              ) : null}
            </div>
            <button
              className="flex items-center gap-1.5 text-text-sub-light dark:text-text-sub-dark hover:text-primary transition-colors text-sm font-medium"
              type="button"
              data-review-share
              onClick={() => onShare?.(review.slug, review.title)}
            >
              <span className="material-symbols-outlined text-[18px]">
                share
              </span>
              <span className="hidden sm:inline">{t(lang, "reviewCard.share")}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
