import Link from "next/link";
import {
  ReviewCardCatalog,
  ReviewCardCatalogData,
  ReviewCardCategory,
  ReviewCardCategoryData,
  ReviewCardProfile,
  ReviewCardProfileData,
} from "@/components/cards/ReviewCard";
import {
  PaginationCatalog,
  PaginationCategory,
  PaginationProfile,
} from "@/components/ui/Pagination";
import CategorySortSelect from "@/components/catalog/CategorySortSelect";
import EmptyState from "@/components/ui/EmptyState";
import type { PaginationInfo } from "@/src/types";
import { Suspense } from "react";

type ReviewListCatalogProps = {
  cards: ReviewCardCatalogData[];
  pagination: PaginationInfo;
  buildHref?: (page: number) => string;
};

export function ReviewListCatalog({
  cards,
  pagination,
  buildHref,
}: ReviewListCatalogProps) {
  return (
    <div className="lg:col-span-8 space-y-6">
      {cards.map((card, index) => (
        <ReviewCardCatalog key={`catalog-${index}`} {...card} />
      ))}
      <PaginationCatalog pagination={pagination} buildHref={buildHref} />
    </div>
  );
}

type ReviewListCategoryProps = {
  cards: ReviewCardCategoryData[];
  pagination: PaginationInfo;
  buildHref?: (page: number) => string;
  sort: "latest" | "popular" | "rating";
};

export function ReviewListCategory({
  cards,
  pagination,
  buildHref,
  sort,
}: ReviewListCategoryProps) {
  return (
    <div className="lg:col-span-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[#0d141b] text-2xl font-bold">Latest Reviews</h2>
        <div className="flex items-center gap-2 text-sm text-[#4c739a]">
          <span>Sort by:</span>
          <Suspense fallback={null}>
            <CategorySortSelect sort={sort} />
          </Suspense>
        </div>
      </div>
      {cards.length > 0 ? (
        cards.map((card, index) => (
          <ReviewCardCategory key={`category-${index}`} {...card} />
        ))
      ) : (
        <EmptyState
          title="No reviews yet"
          description="There are no reviews in this category yet. Be the first to share your experience!"
          ctaLabel="Write first review"
          authenticatedHref="/node/add/review"
        />
      )}
      <PaginationCategory pagination={pagination} buildHref={buildHref} />
    </div>
  );
}

type ReviewListProfileProps = {
  cards: ReviewCardProfileData[];
  pagination: PaginationInfo;
  activeTab: "reviews" | "drafts" | "comments" | "saved";
  reviewCount: number;
  tabHrefs: {
    reviews: string;
    drafts: string;
    comments: string;
    saved: string;
  };
  buildHref?: (page: number) => string;
};

export function ReviewListProfile({
  cards,
  pagination,
  activeTab,
  reviewCount,
  tabHrefs,
  buildHref,
}: ReviewListProfileProps) {
  const emptyState =
    activeTab === "reviews"
      ? {
        title: "No reviews yet",
        description: "Start your profile by sharing your first review.",
        ctaLabel: "Write first review",
      }
      : activeTab === "drafts"
        ? {
          title: "No drafts yet",
          description: "Start a draft to share your experience later.",
          ctaLabel: "Write review",
        }
        : activeTab === "comments"
          ? {
            title: "No comments yet",
            description: "Share your thoughts on others' reviews to see them here.",
            ctaLabel: "Browse reviews",
          }
          : {
            title: "No saved items",
            description: "Bookmark reviews to find them easily later.",
            ctaLabel: "Explore catalog",
          };
  const activeTabClass =
    "flex items-center justify-center border-b-[3px] border-primary text-text-main-light dark:text-text-main-dark py-4 px-2 whitespace-nowrap";
  const inactiveTabClass =
    "flex items-center justify-center border-b-[3px] border-transparent text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark transition-colors py-4 px-2 whitespace-nowrap";

  return (
    <main className="w-full lg:w-2/3 flex flex-col gap-6 order-1 lg:order-2">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm px-4">
        <div className="flex overflow-x-auto no-scrollbar gap-6">
          <Link
            className={activeTab === "reviews" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.reviews}
          >
            <p className="text-sm font-bold tracking-wide">
              Reviews ({reviewCount})
            </p>
          </Link>
          <Link
            className={activeTab === "drafts" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.drafts}
          >
            <p className="text-sm font-bold tracking-wide">Drafts</p>
          </Link>
          <Link
            className={activeTab === "comments" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.comments}
          >
            <p className="text-sm font-bold tracking-wide">Comments</p>
          </Link>
          <Link
            className={activeTab === "saved" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.saved}
          >
            <p className="text-sm font-bold tracking-wide">Saved Items</p>
          </Link>
        </div>
      </div>
      {cards.length > 0 ? (
        cards.map((card, index) => (
          <ReviewCardProfile key={`profile-${index}`} {...card} />
        ))
      ) : (
        <EmptyState
          title={emptyState.title}
          description={emptyState.description}
          ctaLabel={emptyState.ctaLabel}
          authenticatedHref="/node/add/review"
        />
      )}
      <PaginationProfile pagination={pagination} buildHref={buildHref} />
    </main>
  );
}
