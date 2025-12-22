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
      {cards.map((card, index) => (
        <ReviewCardCategory key={`category-${index}`} {...card} />
      ))}
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
  const emptyMessage =
    activeTab === "reviews"
      ? "No reviews yet."
      : activeTab === "comments"
        ? "No comments yet."
        : activeTab === "drafts"
          ? "No drafts yet."
          : "No saved items yet.";
  const activeTabClass =
    "flex items-center justify-center border-b-[3px] border-primary text-text-main-light dark:text-text-main-dark py-4 px-2 whitespace-nowrap";
  const inactiveTabClass =
    "flex items-center justify-center border-b-[3px] border-transparent text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark transition-colors py-4 px-2 whitespace-nowrap";

  return (
    <main className="w-full lg:w-2/3 flex flex-col gap-6 order-1 lg:order-2">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm px-4">
        <div className="flex overflow-x-auto no-scrollbar gap-6">
          <a
            className={activeTab === "reviews" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.reviews}
          >
            <p className="text-sm font-bold tracking-wide">
              Reviews ({reviewCount})
            </p>
          </a>
          <a
            className={activeTab === "drafts" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.drafts}
          >
            <p className="text-sm font-bold tracking-wide">Drafts</p>
          </a>
          <a
            className={activeTab === "comments" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.comments}
          >
            <p className="text-sm font-bold tracking-wide">Comments</p>
          </a>
          <a
            className={activeTab === "saved" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.saved}
          >
            <p className="text-sm font-bold tracking-wide">Saved Items</p>
          </a>
        </div>
      </div>
      {cards.length > 0 ? (
        cards.map((card, index) => (
          <ReviewCardProfile key={`profile-${index}`} {...card} />
        ))
      ) : (
        <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-6 text-sm text-text-sub-light dark:text-text-sub-dark">
          {emptyMessage}
        </div>
      )}
      <PaginationProfile pagination={pagination} buildHref={buildHref} />
    </main>
  );
}
