import Link from "next/link";
import type { Product } from "@/src/types";
import { RatingStarsCatalog } from "@/components/ui/RatingStars";
import {
  buildRatingStars,
  DEFAULT_REVIEW_IMAGE,
  formatCompactNumber,
} from "@/src/lib/review-utils";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

type ProductCardProps = {
  product: Product;
  lang: string;
  categoryLabel?: string;
};

export default function ProductCard({
  product,
  lang,
  categoryLabel,
}: ProductCardProps) {
  const resolvedLang = normalizeLanguage(lang);
  const ratingAvg = product.stats?.ratingAvg ?? 0;
  const ratingLabel =
    ratingAvg > 0 ? ratingAvg.toFixed(1) : t(resolvedLang, "productCard.noRatings");
  const reviewCount = formatCompactNumber(
    product.stats?.reviewCount ?? 0,
    resolvedLang
  );
  const imageUrl = product.images?.[0]?.url ?? DEFAULT_REVIEW_IMAGE;
  const optimizedImageUrl = getOptimizedImageUrl(imageUrl, 600);
  const productHref = localizePath(`/products/${product.slug}`, lang);
  const reviewHref = `${localizePath("/node/add/review", lang)}?productSlug=${encodeURIComponent(
    product.slug
  )}`;

  return (
    <article className="card-hover-glow bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <Link
          className="sm:w-48 sm:shrink-0 active-press"
          href={productHref}
          aria-label={t(resolvedLang, "productCard.ariaView", { name: product.name })}
          prefetch={false}
        >
          <div
            className="aspect-video sm:aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 bg-cover bg-center"
            style={{ backgroundImage: `url(${optimizedImageUrl})` }}
          />
        </Link>
        <div className="flex-1 p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {categoryLabel ? (
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-semibold text-slate-600 dark:text-slate-300">
                  {categoryLabel}
                </span>
              ) : null}
              <span>
                {t(resolvedLang, "productCard.reviewsLabel", { count: reviewCount })}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-2">
              <Link className="hover:text-primary active-press inline-block" href={productHref} prefetch={false}>
                {product.name}
              </Link>
            </h3>
            <RatingStarsCatalog
              stars={buildRatingStars(ratingAvg)}
              valueText={ratingLabel}
            />
            {product.description ? (
              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                {product.description}
              </p>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                {t(resolvedLang, "productCard.noDescription")}
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              className="text-xs font-semibold text-primary hover:underline active-press"
              href={productHref}
              prefetch={false}
            >
              {t(resolvedLang, "productCard.viewProduct")}
            </Link>
            <Link
              className="text-xs font-semibold text-slate-500 hover:text-primary active-press"
              href={reviewHref}
              prefetch={false}
            >
              {t(resolvedLang, "productCard.writeReview")}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
