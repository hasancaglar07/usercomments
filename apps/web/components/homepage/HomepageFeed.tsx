"use client";

import { useMemo, useRef, useState } from "react";
import {
  ReviewCardHomepage,
  type ReviewCardHomepageData,
} from "@/components/cards/ReviewCard";
import type { Category, Review } from "@/src/types";
import {
  FALLBACK_AVATARS,
  FALLBACK_REVIEW_IMAGES,
  buildRatingStars,
  formatCompactNumber,
  formatRelativeTime,
  getCategoryLabel,
  pickFrom,
} from "@/src/lib/review-utils";
import { getLatestReviews } from "@/src/lib/api";

type FilterKey = "all" | "photos" | "verified";

type HomepageFeedProps = {
  initialCards: ReviewCardHomepageData[];
  initialNextCursor: string | null;
  categories: Category[];
  pageSize: number;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "photos", label: "Photos Only" },
  { key: "verified", label: "Verified" },
];

const ACTIVE_FILTER_CLASS =
  "px-3 py-1 text-xs font-medium bg-primary text-white rounded-full";
const INACTIVE_FILTER_CLASS =
  "px-3 py-1 text-xs font-medium bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50";

function getHomepageBadge(review: Review): "verified" | null {
  const rating = review.ratingAvg ?? 0;
  const ratingsCount = review.ratingCount ?? 0;
  if (rating >= 4.5 && ratingsCount >= 10) {
    return "verified";
  }
  return null;
}

function buildHomepageCard(
  review: Review,
  categories: Category[],
  index: number
): ReviewCardHomepageData {
  const categoryName = getCategoryLabel(categories, review.categoryId);
  const relative = formatRelativeTime(review.createdAt);

  return {
    review,
    authorMeta: categoryName ? `Reviewer • ${categoryName}` : "Community Reviewer",
    postedLabel: relative ? `Posted ${relative}` : "Posted recently",
    ratingStars: buildRatingStars(review.ratingAvg),
    ratingValue: (review.ratingAvg ?? 0).toFixed(1),
    imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
    imageAlt: review.title,
    avatarUrl: review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index),
    avatarAlt: `Profile picture of ${review.author.username}`,
    badge: getHomepageBadge(review),
    likesLabel: formatCompactNumber(review.votesUp ?? 0),
    commentsLabel: formatCompactNumber(review.commentCount ?? 0),
    photoCountLabel:
      review.photoCount && review.photoCount > 0
        ? formatCompactNumber(review.photoCount)
        : undefined,
  };
}

function hasPhotos(review: Review): boolean {
  return Boolean(
    (review.photoCount ?? 0) > 0 || (review.photoUrls?.length ?? 0) > 0
  );
}

export default function HomepageFeed({
  initialCards,
  initialNextCursor,
  categories,
  pageSize,
}: HomepageFeedProps) {
  const [cards, setCards] = useState<ReviewCardHomepageData[]>(initialCards);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [isLoading, setIsLoading] = useState(false);
  const seenIds = useRef(new Set(initialCards.map((card) => card.review.id)));

  const visibleCards = useMemo(() => {
    if (filter === "photos") {
      return cards.filter((card) => hasPhotos(card.review));
    }
    if (filter === "verified") {
      return cards.filter((card) => card.badge === "verified");
    }
    return cards;
  }, [cards, filter]);

  const handleLoadMore = async () => {
    if (!nextCursor || isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      const result = await getLatestReviews(pageSize, nextCursor);
      const startIndex = cards.length;
      const nextCards = result.items
        .map((review, index) =>
          buildHomepageCard(review, categories, startIndex + index)
        )
        .filter((card) => {
          const id = card.review.id;
          if (!id || seenIds.current.has(id)) {
            return false;
          }
          seenIds.current.add(id);
          return true;
        });
      if (nextCards.length > 0) {
        setCards((prev) => [...prev, ...nextCards]);
      }
      setNextCursor(result.nextCursor);
    } catch (error) {
      console.error("Failed to load more reviews", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-text-main dark:text-white">
          Recent Reviews
        </h2>
        <div className="flex gap-2">
          {FILTERS.map((item) => {
            const isActive = item.key === filter;
            return (
              <button
                key={item.key}
                className={isActive ? ACTIVE_FILTER_CLASS : INACTIVE_FILTER_CLASS}
                type="button"
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-6">
        {visibleCards.map((card, index) => (
          <ReviewCardHomepage
            key={card.review.id || card.review.slug || `homepage-${index}`}
            {...card}
          />
        ))}
        <button
          className="w-full py-3 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-primary font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          type="button"
          onClick={handleLoadMore}
          disabled={!nextCursor || isLoading}
        >
          {isLoading ? "Loading..." : "Load More Reviews"}
        </button>
      </div>
    </>
  );
}
