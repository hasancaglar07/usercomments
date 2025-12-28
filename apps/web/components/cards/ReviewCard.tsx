"use client";

import Link from "next/link";
import { useState } from "react";
import {
  RatingStarsCatalog,
  RatingStarsCategory,
  RatingStarsHomepage,
  RatingStarsProfile,
} from "@/components/ui/RatingStars";
import type { Review, StarType } from "@/src/types";
import { t } from "@/src/lib/copy";
import type { SupportedLanguage } from "@/src/lib/i18n";

// Helper component for Blur-Up effect
function BlurImage({ src, alt, className, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className={`overflow-hidden bg-gray-200 dark:bg-gray-800 ${className}`}>
      <img
        alt={alt}
        src={src}
        className={`h-full w-full object-cover transition-all duration-700 ease-in-out ${isLoading
          ? "scale-110 blur-xl grayscale opacity-0"
          : "scale-100 blur-0 grayscale-0 opacity-100"
          }`}
        onLoad={() => setIsLoading(false)}
        {...props}
      />
    </div>
  );
}

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
  layout?: "horizontal" | "vertical";
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
  layout = "horizontal",
}: ReviewCardHomepageProps) {
  const authorName = review.author.displayName ?? review.author.username;
  const optimizedImageUrl = getOptimizedImageUrl(imageUrl, 600);
  const optimizedAvatarUrl = getOptimizedImageUrl(avatarUrl, 100);
  const [isImageLoading, setIsImageLoading] = useState(true);

  const galleryPhotos = review.photoUrls?.slice(1, 6) || [];
  const remainingCount = (review.photoUrls?.length || 0) - 6;

  if (layout === "vertical") {
    return (
      <article className="card-hover-glow group relative flex flex-col bg-white dark:bg-surface-dark rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-gray-100/50 dark:border-gray-800 h-full overflow-hidden">
        <Link href={href} className="relative aspect-[4/3] w-full overflow-hidden block bg-gray-200 dark:bg-gray-800 active-press">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={imageAlt}
            className={`h-full w-full object-cover transition-all duration-300 ease-in-out group-hover:scale-105 ${isImageLoading
              ? "scale-110 blur-xl grayscale opacity-0"
              : "scale-100 blur-0 grayscale-0 opacity-100"
              }`}
            decoding="async"
            fetchPriority={imagePriority ? "high" : "auto"}
            loading={imagePriority ? "eager" : "lazy"}
            src={optimizedImageUrl}
            onLoad={() => setIsImageLoading(false)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

          {badge === "verified" && (
            <div className="absolute top-3 right-3">
              <div className="flex items-center gap-1 bg-white/95 dark:bg-black/80 backdrop-blur text-emerald-700 dark:text-emerald-400 text-[10px] px-2.5 py-1 rounded-full font-bold shadow-sm uppercase tracking-wide">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                <span>{t(lang, "reviewCard.verifiedPurchase")}</span>
              </div>
            </div>
          )}

          <div className="absolute bottom-3 left-4 right-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full border border-white/30 overflow-hidden shrink-0">
                <img alt={avatarAlt} className="w-full h-full object-cover" src={optimizedAvatarUrl} />
              </div>
              <span className="text-xs font-medium text-white/90 truncate drop-shadow-sm">{authorName}</span>
            </div>
            <h3 className="text-lg font-bold text-white leading-tight line-clamp-2 drop-shadow-md">
              {review.title}
            </h3>
          </div>
        </Link>
        <div className="p-4 flex flex-col flex-1 gap-3">
          <div className="flex items-center justify-between">
            <RatingStarsHomepage stars={ratingStars} valueText={ratingValue} />
            <span className="text-xs text-text-muted font-medium">{postedLabel}</span>
          </div>

          <p className="text-sm text-text-sub line-clamp-2 leading-relaxed flex-1 opacity-90">
            {review.excerpt}
          </p>

          {galleryPhotos.length > 0 && (
            <div className="flex gap-2 pt-2 border-t border-gray-50 dark:border-gray-800/50">
              {galleryPhotos.map((photo, index) => (
                <div
                  key={index}
                  className={`relative w-10 h-10 rounded-md overflow-hidden shrink-0 border border-gray-100 dark:border-gray-800 ${index >= 3 ? 'hidden sm:block' : ''}`}
                >
                  <img
                    src={getOptimizedImageUrl(photo, 100)}
                    alt={`Thumb ${index}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Mobile Overlay (on 3rd item) */}
                  {index === 2 && (review.photoUrls?.length || 0) > 3 && (
                    <div className="absolute inset-0 bg-black/50 flex sm:hidden items-center justify-center text-white text-[9px] font-bold transition-colors group-hover/img:bg-black/60">
                      +{(review.photoUrls?.length || 0) - 3}
                    </div>
                  )}

                  {/* Desktop Overlay (on 5th item) */}
                  {index === 4 && remainingCount > 0 && (
                    <div className="absolute inset-0 bg-black/50 hidden sm:flex items-center justify-center text-white text-[10px] font-bold transition-colors group-hover/img:bg-black/60">
                      +{remainingCount}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-1.5 text-text-muted hover:text-primary transition-colors text-xs font-semibold cursor-pointer active-press group/like">
              <span className="material-symbols-outlined text-[18px] group-active/like:animate-pop-like transition-transform">thumb_up</span>
              <span>{likesLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 text-text-muted hover:text-primary transition-colors text-xs font-semibold cursor-pointer active-press">
              <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
              <span>{commentsLabel}</span>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="card-hover-glow group flex flex-col sm:flex-row bg-white dark:bg-surface-dark rounded-none border-b border-gray-100 dark:border-gray-800 sm:rounded-2xl sm:border sm:shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="w-full sm:w-64 h-56 sm:h-auto flex-shrink-0 relative overflow-hidden">
        <Link href={href} className="block h-full w-full active-press">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={imageAlt}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            decoding="async"
            fetchPriority={imagePriority ? "high" : "auto"}
            loading={imagePriority ? "eager" : "lazy"}
            src={optimizedImageUrl}
          />
          {badge && (
            <div className="absolute top-3 left-3">
              {badge === "verified" ? (
                <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur text-emerald-700 text-[10px] px-2.5 py-1 rounded-full font-bold shadow-sm uppercase tracking-wide">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  {t(lang, "reviewCard.verifiedPurchase")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur text-blue-700 text-[10px] px-2.5 py-1 rounded-full font-bold shadow-sm uppercase tracking-wide">
                  <span className="material-symbols-outlined text-[14px]">diamond</span>
                  {t(lang, "reviewCard.expert")}
                </span>
              )}
            </div>
          )}
        </Link>
      </div>

      <div className="flex-1 p-4 sm:p-6 flex flex-col">
        {/* Header: Author & Date */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-gray-700 overflow-hidden shrink-0">
              <img alt={avatarAlt} className="h-full w-full object-cover" src={optimizedAvatarUrl} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text-main dark:text-white leading-none">{authorName}</span>
              <span className="text-[11px] text-text-muted mt-0.5">{authorMeta}</span>
            </div>
          </div>
          <div className="ml-auto shrink-0">
            <RatingStarsHomepage stars={ratingStars} valueText={ratingValue} />
          </div>
        </div>

        {/* Content: Title & Rating */}
        <div className="mb-2">
          <Link href={href} className="group-hover:text-primary transition-colors active-press block">
            <h3 className="text-[17px] sm:text-xl font-bold text-text-main dark:text-white leading-tight line-clamp-2">
              {review.title}
            </h3>
          </Link>
        </div>

        {/* Excerpt */}
        <p className="text-sm text-text-sub dark:text-gray-300 line-clamp-2 mb-4 leading-relaxed">
          {review.excerpt}
        </p>

        {/* Gallery & Footer Split */}
        <div className="mt-auto flex flex-col gap-4">
          {galleryPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2.5">
              {galleryPhotos.map((photo, index) => (
                <div
                  key={index}
                  className={`relative w-full aspect-[4/3] sm:w-24 sm:h-24 sm:aspect-square rounded-lg overflow-hidden shrink-0 border border-gray-100 dark:border-gray-800 shadow-sm cursor-pointer hover:ring-2 ring-primary/20 transition-all ${index >= 3 ? 'hidden sm:block' : ''}`}
                >
                  <img
                    src={getOptimizedImageUrl(photo, 300)}
                    alt={`Gallery ${index}`}
                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />

                  {/* Mobile Overlay (on 3rd item) */}
                  {index === 2 && (review.photoUrls?.length || 0) > 3 && (
                    <div className="absolute inset-0 bg-black/50 flex sm:hidden items-center justify-center text-white text-xs font-bold transition-colors backdrop-blur-[1px]">
                      +{(review.photoUrls?.length || 0) - 3}
                    </div>
                  )}

                  {/* Desktop Overlay (on 5th item) */}
                  {index === 4 && remainingCount > 0 && (
                    <div className="absolute inset-0 bg-black/50 hidden sm:flex items-center justify-center text-white text-sm font-bold transition-colors backdrop-blur-[1px]">
                      +{remainingCount}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-6 pt-3 border-t border-gray-50 dark:border-gray-800">
            <button className="flex items-center gap-1.5 text-text-muted hover:text-primary transition-colors text-xs font-bold uppercase tracking-wide active-press group/like">
              <span className="material-symbols-outlined text-[18px] group-active/like:animate-pop-like transition-transform">thumb_up</span>
              <span>{likesLabel}</span>
            </button>
            <button className="flex items-center gap-1.5 text-text-muted hover:text-primary transition-colors text-xs font-bold uppercase tracking-wide active-press">
              <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
              <span>{commentsLabel}</span>
            </button>
            <span className="ml-auto block text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md">
              {postedLabel}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
// Compact variant for Trending/Hero section - Optimized for Mobile Density
export function ReviewCardTrending({
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
  lang,
  imagePriority = false,
}: ReviewCardHomepageProps) {
  const authorName = review.author.displayName ?? review.author.username;
  const optimizedImageUrl = getOptimizedImageUrl(imageUrl, 300);
  const optimizedAvatarUrl = getOptimizedImageUrl(avatarUrl, 100);
  const [isImageLoading, setIsImageLoading] = useState(true);

  return (
    <article className="card-hover-glow group flex flex-row sm:flex-col bg-white dark:bg-surface-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden h-full">
      <div className="w-24 min-h-[6rem] sm:w-full sm:h-48 sm:min-h-0 shrink-0 relative overflow-hidden bg-gray-200 dark:bg-gray-800">
        <Link href={href} className="block h-full w-full relative active-press">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={imageAlt}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-300 ease-in-out group-hover:scale-105 ${isImageLoading
              ? "scale-110 blur-xl grayscale opacity-0"
              : "scale-100 blur-0 grayscale-0 opacity-100"
              }`}
            decoding="async"
            fetchPriority={imagePriority ? "high" : "auto"}
            loading={imagePriority ? "eager" : "lazy"}
            src={optimizedImageUrl}
            onLoad={() => setIsImageLoading(false)}
          />
        </Link>
      </div>

      <div className="flex-1 p-2.5 sm:p-4 flex flex-col min-w-0">
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full border border-gray-100 dark:border-gray-700 overflow-hidden shrink-0">
              <img alt={avatarAlt} className="h-full w-full object-cover" src={optimizedAvatarUrl} />
            </div>
            <span className="text-[11px] sm:text-sm font-bold text-text-main dark:text-white truncate max-w-[70px] sm:max-w-none">{authorName}</span>
          </div>
          <div className="scale-75 origin-right sm:scale-100">
            <RatingStarsHomepage stars={ratingStars} valueText={ratingValue} />
          </div>
        </div>

        <Link href={href} className="group-hover:text-primary transition-colors mb-1 block active-press">
          <h3 className="text-[13px] sm:text-xl font-bold text-text-main dark:text-white leading-4 sm:leading-tight line-clamp-2">
            {review.title}
          </h3>
        </Link>

        <p className="text-[11px] sm:text-sm text-text-sub dark:text-gray-400 line-clamp-2 leading-snug mb-1 sm:mb-4 flex-1">
          {review.excerpt}
        </p>

        <div className="hidden sm:flex mt-auto items-center gap-3 pt-2 sm:pt-3 border-t border-gray-50 dark:border-gray-800/50">
          <span className="text-[10px] sm:text-xs text-text-muted truncate">{postedLabel}</span>
          <div className="flex items-center gap-3 ml-auto text-text-muted">
            <span className="flex items-center gap-1 text-[10px] sm:text-xs font-bold hover:text-primary transition-colors cursor-pointer active-press">
              <span className="material-symbols-outlined text-[14px] sm:text-[16px]">thumb_up</span>
              {likesLabel}
            </span>
            <span className="flex items-center gap-1 text-[10px] sm:text-xs font-bold hover:text-primary transition-colors cursor-pointer active-press">
              <span className="material-symbols-outlined text-[14px] sm:text-[16px]">chat_bubble</span>
              {commentsLabel}
            </span>
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
    <article className="card-hover-glow bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="p-6 sm:flex gap-6">
        <div className="sm:w-48 sm:shrink-0 mb-4 sm:mb-0">
          <Link href={href} className="block w-full active-press">
            <div
              className="aspect-video sm:aspect-[4/3] w-full bg-slate-100 rounded-lg bg-cover bg-center relative overflow-hidden group"
              data-alt={imageAlt}
              style={{ backgroundImage: `url(${optimizedImageUrl})` }}
            >
              {showImageOverlay ? (
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              ) : null}
            </div>
          </Link>
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
              className="hover:underline active-press inline-block"
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
        <Link href={href} className="block w-full active-press">
          <div
            className="aspect-[4/3] md:aspect-square w-full rounded-lg bg-cover bg-center border border-[#e7edf3]"
            data-alt={imageAlt}
            style={{ backgroundImage: `url(${optimizedImageUrl})` }}
          />
        </Link>
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
          <Link href={href} prefetch={false} className="active-press inline-block">
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
          className="text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark active-press"
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
        <Link href={href} className="block w-full sm:w-32 shrink-0 active-press">
          <div
            className="w-full h-48 sm:h-32 rounded-lg bg-cover bg-center border border-border-light dark:border-border-dark"
            data-alt={imageAlt}
            style={{ backgroundImage: `url(${optimizedImageUrl})` }}
          />
        </Link>
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-background-light dark:bg-background-dark text-[10px] font-bold uppercase tracking-wider text-text-sub-light dark:text-text-sub-dark border border-border-light dark:border-border-dark">
              {tagLabel}
            </span>
          </div>
          <h2 className="text-xl font-bold text-text-main-light dark:text-text-main-dark mb-2 hover:text-primary transition-colors">
            <Link href={href} prefetch={false} className="active-press inline-block">
              {review.title}
            </Link>
          </h2>
          <p className="text-text-sub-light dark:text-text-sub-dark text-sm line-clamp-3 mb-4 leading-relaxed">
            {review.excerpt}
          </p>
          <Link
            className="text-primary text-sm font-bold hover:underline mb-4 inline-block active-press"
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
              className="flex items-center gap-1.5 text-text-sub-light dark:text-text-sub-dark hover:text-primary transition-colors text-sm font-medium active-press"
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
