import Link from "next/link";
import { RatingStarsHomepage } from "@/components/ui/RatingStars";
import type { ReviewCardHomepageData } from "@/components/cards/ReviewCard";
import type { SupportedLanguage } from "@/src/lib/i18n";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";
import ReviewCardTrendingImage from "@/components/cards/ReviewCardTrendingImage";

type ReviewCardTrendingProps = ReviewCardHomepageData & {
  lang: SupportedLanguage;
  imagePriority?: boolean;
  layout?: "horizontal" | "vertical";
};

export default function ReviewCardTrending({
  review,
  href,
  postedLabel,
  ratingStars,
  ratingValue,
  imageUrl,
  imageAlt,
  avatarUrl,
  avatarAlt,
  likesLabel,
  commentsLabel,
  imagePriority = false,
}: ReviewCardTrendingProps) {
  const authorName = review.author.displayName ?? review.author.username;
  const optimizedImageUrl = getOptimizedImageUrl(imageUrl, 300);
  const optimizedAvatarUrl = getOptimizedImageUrl(avatarUrl, 64);

  return (
    <article className="card-hover-glow group flex flex-row sm:flex-col bg-white dark:bg-surface-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden h-full">
      <div className="w-24 min-h-[6rem] sm:w-full sm:h-48 sm:min-h-0 shrink-0 relative overflow-hidden bg-gray-200 dark:bg-gray-800">
        <Link href={href} prefetch={false} className="block h-full w-full relative active-press">
          <ReviewCardTrendingImage
            alt={imageAlt}
            src={optimizedImageUrl}
            imagePriority={imagePriority}
          />
        </Link>
      </div>

      <div className="flex-1 p-2.5 sm:p-4 flex flex-col min-w-0">
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full border border-gray-100 dark:border-gray-700 overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={avatarAlt}
                className="h-full w-full object-cover"
                src={optimizedAvatarUrl}
                decoding="async"
                loading="lazy"
              />
            </div>
            <span className="text-[11px] sm:text-sm font-bold text-text-main dark:text-white truncate max-w-[70px] sm:max-w-none">
              {authorName}
            </span>
          </div>
          <div className="scale-75 origin-right sm:scale-100">
            <RatingStarsHomepage stars={ratingStars} valueText={ratingValue} />
          </div>
        </div>

        <Link
          href={href}
          prefetch={false}
          className="group-hover:text-primary transition-colors mb-1 block active-press"
        >
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
