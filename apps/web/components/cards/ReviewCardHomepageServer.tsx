import Link from "next/link";
import { RatingStarsHomepage } from "@/components/ui/RatingStars";
import type { ReviewCardHomepageData } from "@/components/cards/ReviewCard";
import type { SupportedLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";

type ReviewCardHomepageServerProps = ReviewCardHomepageData & {
  lang: SupportedLanguage;
  imagePriority?: boolean;
};

export default function ReviewCardHomepageServer({
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
}: ReviewCardHomepageServerProps) {
  const authorName = review.author.displayName ?? review.author.username;
  const optimizedImageUrl = getOptimizedImageUrl(imageUrl, 600);
  const optimizedAvatarUrl = getOptimizedImageUrl(avatarUrl, 64);
  const galleryPhotos = review.photoUrls?.slice(1, 6) || [];
  const remainingCount = (review.photoUrls?.length || 0) - 6;

  return (
    <article className="card-hover-glow group flex flex-col sm:flex-row bg-white dark:bg-surface-dark rounded-none border-b border-gray-100 dark:border-gray-800 sm:rounded-2xl sm:border sm:shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="w-full sm:w-64 h-56 sm:h-auto flex-shrink-0 relative overflow-hidden">
        <Link href={href} prefetch={false} className="block h-full w-full active-press">
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={avatarAlt}
                className="h-full w-full object-cover"
                src={optimizedAvatarUrl}
                decoding="async"
                loading="lazy"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text-main dark:text-white leading-none">
                {authorName}
              </span>
              <span className="text-[11px] text-text-muted mt-0.5">{authorMeta}</span>
            </div>
          </div>
          <div className="ml-auto shrink-0">
            <RatingStarsHomepage stars={ratingStars} valueText={ratingValue} />
          </div>
        </div>

        {/* Content: Title & Rating */}
        <div className="mb-2">
          <Link
            href={href}
            prefetch={false}
            className="group-hover:text-primary transition-colors active-press block"
          >
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
                  className={`relative w-full aspect-[4/3] sm:w-24 sm:h-24 sm:aspect-square rounded-lg overflow-hidden shrink-0 border border-gray-100 dark:border-gray-800 shadow-sm cursor-pointer hover:ring-2 ring-primary/20 transition-all ${index >= 3 ? "hidden sm:block" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getOptimizedImageUrl(photo, 300)}
                    alt={`Gallery ${index}`}
                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
                    decoding="async"
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
              <span className="material-symbols-outlined text-[18px] group-active/like:animate-pop-like transition-transform">
                thumb_up
              </span>
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
