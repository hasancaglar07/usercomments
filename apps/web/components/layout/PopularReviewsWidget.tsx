import Link from "next/link";
import type { Category, Review } from "@/src/types";
import { formatCompactNumber, getCategoryLabel } from "@/src/lib/review-utils";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";
import type { CatalogPopularTopic } from "@/components/layout/Sidebar";

const POPULAR_RATING_THRESHOLD = 0;
const POPULAR_VIEWS_THRESHOLD = 100;

function hasReviewPhoto(review: Review): boolean {
  return Array.isArray(review.photoUrls) && review.photoUrls.length > 0;
}

function isPopularReview(review: Review): boolean {
  const rating = review.ratingAvg ?? 0;
  const views = review.views ?? 0;
  return rating > POPULAR_RATING_THRESHOLD || views > POPULAR_VIEWS_THRESHOLD;
}

export function buildPopularTopics(
  reviews: Review[],
  categories: Category[],
  lang: string,
  limit = 4
): CatalogPopularTopic[] {
  const resolvedLang = normalizeLanguage(lang);
  const eligible = reviews.filter(isPopularReview);
  const withImages: Review[] = [];
  const withoutImages: Review[] = [];

  eligible.forEach((review) => {
    if (hasReviewPhoto(review)) {
      withImages.push(review);
    } else {
      withoutImages.push(review);
    }
  });

  return [...withImages, ...withoutImages].slice(0, limit).map((review, index) => {
    const categoryLabel =
      getCategoryLabel(categories, review.categoryId) ??
      t(resolvedLang, "common.general");

    return {
      slug: review.slug,
      rankLabel: String(index + 1).padStart(2, "0"),
      title: review.title,
      metaLabel: t(resolvedLang, "catalog.popularTopicMeta", {
        category: categoryLabel,
        count: formatCompactNumber(review.ratingCount ?? 0, resolvedLang),
      }),
      thumbnailUrl: hasReviewPhoto(review) ? review.photoUrls?.[0] : undefined,
      thumbnailAlt: review.title,
    };
  });
}

type PopularReviewsWidgetProps = {
  lang: string;
  topics: CatalogPopularTopic[];
};

export default function PopularReviewsWidget({
  lang,
  topics,
}: PopularReviewsWidgetProps) {
  const resolvedLang = normalizeLanguage(lang);

  return (
    <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900 dark:text-white">
          {t(resolvedLang, "sidebar.popularRightNow")}
        </h3>
        <span className="material-symbols-outlined text-secondary">
          local_fire_department
        </span>
      </div>
      <ul className="space-y-4">
        {topics.map((topic, index) => (
          <li key={`${topic.rankLabel}-${index}`}>
            <Link
              className="flex gap-3 items-start group cursor-pointer"
              href={localizePath(`/content/${topic.slug}`, lang)}
            >
              <div className="text-2xl font-black text-slate-200 dark:text-slate-700 leading-none group-hover:text-primary transition-colors">
                {topic.rankLabel}
              </div>
              {topic.thumbnailUrl ? (
                <div
                  className="size-10 rounded-lg bg-cover bg-center shrink-0"
                  data-alt={topic.thumbnailAlt}
                  style={{ backgroundImage: `url(${topic.thumbnailUrl})` }}
                />
              ) : null}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">
                  {topic.title}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {topic.metaLabel}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
