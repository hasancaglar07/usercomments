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
import { normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

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
    <div className="lg:col-span-8 space-y-6 -mx-4 sm:mx-0">
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
  lang: string;
};

export function ReviewListCategory({
  cards,
  pagination,
  buildHref,
  sort,
  lang,
}: ReviewListCategoryProps) {
  const resolvedLang = normalizeLanguage(lang);
  return (
    <div className="lg:col-span-8 flex flex-col gap-6 -mx-4 sm:mx-0">
      <div className="flex items-center justify-between">
        <h2 className="text-[#0d141b] text-2xl font-bold">
          {t(resolvedLang, "reviewList.category.latestTitle")}
        </h2>
        <div className="flex items-center gap-2 text-sm text-[#4c739a]">
          <span>{t(resolvedLang, "reviewList.category.sortBy")}</span>
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
          title={t(resolvedLang, "reviewList.category.empty.title")}
          description={t(resolvedLang, "reviewList.category.empty.description")}
          ctaLabel={t(resolvedLang, "reviewList.category.empty.cta")}
          authenticatedHref="/node/add/review"
        />
      )}
      <PaginationCategory pagination={pagination} buildHref={buildHref} lang={resolvedLang} />
    </div>
  );
}

type ReviewListProfileProps = {
  cards: ReviewCardProfileData[];
  pagination: PaginationInfo;
  activeTab: "reviews" | "drafts" | "comments" | "saved";
  reviewCount: number;
  lang: string;
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
  lang,
  tabHrefs,
  buildHref,
}: ReviewListProfileProps) {
  const resolvedLang = normalizeLanguage(lang);
  const emptyState =
    activeTab === "reviews"
      ? {
        title: t(resolvedLang, "reviewList.profile.empty.reviews.title"),
        description: t(resolvedLang, "reviewList.profile.empty.reviews.description"),
        ctaLabel: t(resolvedLang, "reviewList.profile.empty.reviews.cta"),
      }
      : activeTab === "drafts"
        ? {
          title: t(resolvedLang, "reviewList.profile.empty.drafts.title"),
          description: t(resolvedLang, "reviewList.profile.empty.drafts.description"),
          ctaLabel: t(resolvedLang, "reviewList.profile.empty.drafts.cta"),
        }
        : activeTab === "comments"
          ? {
            title: t(resolvedLang, "reviewList.profile.empty.comments.title"),
            description: t(resolvedLang, "reviewList.profile.empty.comments.description"),
            ctaLabel: t(resolvedLang, "reviewList.profile.empty.comments.cta"),
          }
          : {
            title: t(resolvedLang, "reviewList.profile.empty.saved.title"),
            description: t(resolvedLang, "reviewList.profile.empty.saved.description"),
            ctaLabel: t(resolvedLang, "reviewList.profile.empty.saved.cta"),
          };
  const activeTabClass =
    "flex items-center justify-center border-b-[3px] border-primary text-text-main-light dark:text-text-main-dark py-4 px-2 whitespace-nowrap";
  const inactiveTabClass =
    "flex items-center justify-center border-b-[3px] border-transparent text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark transition-colors py-4 px-2 whitespace-nowrap";

  return (
    <main className="w-full lg:w-2/3 flex flex-col gap-6 order-1 lg:order-2 -mx-4 sm:mx-0">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm px-4">
        <div className="flex overflow-x-auto no-scrollbar gap-6">
          <Link
            className={activeTab === "reviews" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.reviews}
          >
            <p className="text-sm font-bold tracking-wide">
              {t(resolvedLang, "reviewList.profile.tab.reviews", {
                count: reviewCount,
              })}
            </p>
          </Link>
          <Link
            className={activeTab === "drafts" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.drafts}
          >
            <p className="text-sm font-bold tracking-wide">
              {t(resolvedLang, "reviewList.profile.tab.drafts")}
            </p>
          </Link>
          <Link
            className={activeTab === "comments" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.comments}
          >
            <p className="text-sm font-bold tracking-wide">
              {t(resolvedLang, "reviewList.profile.tab.comments")}
            </p>
          </Link>
          <Link
            className={activeTab === "saved" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.saved}
          >
            <p className="text-sm font-bold tracking-wide">
              {t(resolvedLang, "reviewList.profile.tab.saved")}
            </p>
          </Link>
        </div>
      </div>
      {cards.length > 0 ? (
        cards.map((card, index) => (
          <ReviewCardProfile key={`profile-${index}`} {...card} lang={resolvedLang} />
        ))
      ) : (
        <EmptyState
          title={emptyState.title}
          description={emptyState.description}
          ctaLabel={emptyState.ctaLabel}
          authenticatedHref="/node/add/review"
        />
      )}
      <PaginationProfile pagination={pagination} buildHref={buildHref} lang={resolvedLang} />
    </main>
  );
}
