"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  ReviewCardProfile,
  type ReviewCardProfileData,
} from "@/components/cards/ReviewCard";
import { useUserProfileActions } from "@/components/user/UserProfileActionsClient";
import { PaginationProfile } from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import type { Category, PaginationInfo, Review } from "@/src/types";
import {
  FALLBACK_REVIEW_IMAGES,
  buildRatingStars,
  formatCompactNumber,
  formatRelativeTime,
  getCategoryLabel,
  pickFrom,
} from "@/src/lib/review-utils";
import { getUserComments } from "@/src/lib/api";
import { getProfile, getUserDrafts, getUserSaved } from "@/src/lib/api-client";
import { ensureAuthLoaded, getAccessToken, getCurrentUser } from "@/src/lib/auth";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

type ProfileTab = "reviews" | "drafts" | "comments" | "saved";

type ReviewListProfileClientProps = {
  username: string;
  activeTab: ProfileTab;
  initialCards: ReviewCardProfileData[];
  initialPagination: PaginationInfo;
  reviewCount: number;
  tabHrefs: {
    reviews: string;
    drafts: string;
    comments: string;
    saved: string;
  };
  page: number;
  pageSize: number;
  categories: Category[];
};

const DEFAULT_PAGE_SIZE = 10;
const PROFILE_SKELETON_COUNT = 3;

function ProfileListSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={`profile-skeleton-${index}`}
          className="flex flex-col bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 shadow-sm animate-pulse"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
            <div className="h-5 w-5 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="flex gap-4 sm:gap-6 flex-col sm:flex-row">
            <div className="w-full sm:w-32 h-48 sm:h-32 rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="flex flex-col flex-1 gap-3">
              <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="mt-auto pt-4 border-t border-border-light dark:border-border-dark flex items-center justify-between">
                <div className="flex gap-4">
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="h-3 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          </div>
        </article>
      ))}
    </>
  );
}

function buildProfileCards(
  reviews: Review[],
  categories: Category[],
  lang: string
): ReviewCardProfileData[] {
  const resolvedLang = normalizeLanguage(lang);
  return reviews.map((review, index) => ({
    review,
    href: localizePath(`/content/${review.slug}`, lang),
    dateLabel: formatRelativeTime(review.createdAt, resolvedLang),
    ratingStars: buildRatingStars(review.ratingAvg),
    imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
    imageAlt: review.title,
    tagLabel:
      getCategoryLabel(categories, review.categoryId) ??
      t(resolvedLang, "common.general"),
    likesLabel: formatCompactNumber(review.votesUp ?? 0, resolvedLang),
    commentsLabel: formatCompactNumber(review.commentCount ?? 0, resolvedLang),
  }));
}

export default function ReviewListProfileClient({
  username,
  activeTab,
  initialCards,
  initialPagination,
  reviewCount,
  tabHrefs,
  page,
  pageSize,
  categories,
}: ReviewListProfileClientProps) {
  const params = useParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );
  const [cards, setCards] = useState<ReviewCardProfileData[]>(initialCards);
  const [pagination, setPagination] = useState<PaginationInfo>(initialPagination);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerResolved, setOwnerResolved] = useState(false);
  const skeletonCount = Math.min(pageSize, PROFILE_SKELETON_COUNT);
  const {
    onReviewComment,
    onReviewReport,
    onReviewShare,
    onReviewVote,
  } = useUserProfileActions();

  const emptyState = useMemo(() => {
    if (activeTab === "reviews") {
      return {
        title: t(lang, "reviewList.profile.empty.reviews.title"),
        description: t(lang, "reviewList.profile.empty.reviews.description"),
        ctaLabel: t(lang, "reviewList.profile.empty.reviews.cta"),
      };
    }
    if (activeTab === "drafts") {
      return {
        title: t(lang, "reviewList.profile.empty.drafts.title"),
        description: t(lang, "reviewList.profile.empty.drafts.description"),
        ctaLabel: t(lang, "reviewList.profile.empty.drafts.cta"),
      };
    }
    if (activeTab === "comments") {
      return {
        title: t(lang, "reviewList.profile.empty.comments.title"),
        description: t(lang, "reviewList.profile.empty.comments.description"),
        ctaLabel: t(lang, "reviewList.profile.empty.comments.cta"),
      };
    }
    return {
      title: t(lang, "reviewList.profile.empty.saved.title"),
      description: t(lang, "reviewList.profile.empty.saved.description"),
      ctaLabel: t(lang, "reviewList.profile.empty.saved.cta"),
    };
  }, [activeTab, lang]);

  useEffect(() => {
    let isMounted = true;
    const resolveOwner = async () => {
      if (isMounted) {
        setOwnerResolved(false);
      }
      try {
        await ensureAuthLoaded();
        if (!getAccessToken()) {
          if (isMounted) {
            setIsOwner(false);
            setOwnerResolved(true);
          }
          return;
        }

        const user = getCurrentUser();
        const metaUsername =
          typeof user?.user_metadata?.username === "string"
            ? user.user_metadata.username
            : user?.email?.split("@")[0];
        let owner =
          typeof metaUsername === "string" &&
          metaUsername.toLowerCase() === username.toLowerCase();

        if (!owner) {
          try {
            const profile = await getProfile();
            if (profile?.username) {
              owner = profile.username.toLowerCase() === username.toLowerCase();
            }
          } catch (error) {
            console.error("Failed to resolve profile owner", error);
          }
        }

        if (isMounted) {
          setIsOwner(owner);
          setOwnerResolved(true);
        }
      } catch (error) {
        console.error("Failed to resolve auth session", error);
        if (isMounted) {
          setIsOwner(false);
          setOwnerResolved(true);
        }
      }
    };

    resolveOwner();
    return () => {
      isMounted = false;
    };
  }, [username]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setErrorMessage(null);

      if (activeTab === "drafts" || activeTab === "saved") {
        if (!ownerResolved) {
          setLoading(true);
          return;
        }
        if (!isOwner) {
          setLoading(false);
          setCards([]);
          setPagination({ page, pageSize, totalPages: 1, totalItems: 0 });
          setErrorMessage(t(lang, "profileClient.error.ownerOnly"));
          return;
        }

        setLoading(true);
        try {
          await ensureAuthLoaded();
          if (!getAccessToken()) {
            if (isMounted) {
              setCards([]);
              setPagination({
                page,
                pageSize,
                totalPages: 1,
                totalItems: 0,
              });
              setErrorMessage(t(lang, "profileClient.error.signInRequired"));
            }
            return;
          }

          const result =
            activeTab === "drafts"
              ? await getUserDrafts(username, page, pageSize, lang)
              : await getUserSaved(username, page, pageSize, lang);
          if (!isMounted) {
            return;
          }
          setCards(buildProfileCards(result.items, categories, lang));
          setPagination(result.pageInfo);
        } catch (error) {
          if (!isMounted) {
            return;
          }
          console.error("Failed to load profile tab data", error);
          setCards([]);
          setPagination({ page, pageSize, totalPages: 1, totalItems: 0 });
          setErrorMessage(t(lang, "profileClient.error.loadFailed"));
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
        return;
      }

      if (activeTab === "comments" && initialCards.length === 0) {
        setLoading(true);
        try {
          const result = await getUserComments(username, page, pageSize, lang);
          if (!isMounted) {
            return;
          }
          setCards(buildProfileCards(result.items, categories, lang));
          setPagination(result.pageInfo);
        } catch (error) {
          if (!isMounted) {
            return;
          }
          console.error("Failed to load comments tab", error);
          setCards([]);
          setPagination({ page, pageSize, totalPages: 1, totalItems: 0 });
          setErrorMessage(t(lang, "profileClient.error.commentsFailed"));
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
        return;
      }

      setCards(initialCards);
      setPagination(initialPagination);
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [
    activeTab,
    categories,
    initialCards,
    initialPagination,
    isOwner,
    ownerResolved,
    page,
    pageSize,
    username,
    lang,
  ]);

  const activeTabClass =
    "flex items-center justify-center border-b-[3px] border-primary text-text-main-light dark:text-text-main-dark py-4 px-2 whitespace-nowrap";
  const inactiveTabClass =
    "flex items-center justify-center border-b-[3px] border-transparent text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark transition-colors py-4 px-2 whitespace-nowrap";

  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      params.set("pageSize", String(pageSize));
    }
    params.set("tab", activeTab);
    params.set("page", String(targetPage));
    return `?${params.toString()}`;
  };

  const reviewCountLabel = formatCompactNumber(reviewCount, lang);
  const restrictedTabs = ownerResolved && !isOwner;
  const handleRestrictedTabClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!restrictedTabs) {
      return;
    }
    event.preventDefault();
    setLoading(false);
    setErrorMessage(t(lang, "profileClient.error.ownerOnly"));
    setCards([]);
    setPagination({ page, pageSize, totalPages: 1, totalItems: 0 });
  };

  return (
    <main className="w-full lg:w-2/3 flex flex-col gap-6 order-1 lg:order-2">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm px-4">
        <div className="flex overflow-x-auto no-scrollbar gap-6">
          <Link
            className={activeTab === "reviews" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.reviews}
          >
            <p className="text-sm font-bold tracking-wide">
              {t(lang, "reviewList.profile.tab.reviews", { count: reviewCountLabel })}
            </p>
          </Link>
          <Link
            className={activeTab === "drafts" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.drafts}
            aria-disabled={restrictedTabs}
            onClick={handleRestrictedTabClick}
          >
            <p className="text-sm font-bold tracking-wide">
              {t(lang, "reviewList.profile.tab.drafts")}
            </p>
          </Link>
          <Link
            className={activeTab === "comments" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.comments}
          >
            <p className="text-sm font-bold tracking-wide">
              {t(lang, "reviewList.profile.tab.comments")}
            </p>
          </Link>
          <Link
            className={activeTab === "saved" ? activeTabClass : inactiveTabClass}
            href={tabHrefs.saved}
            aria-disabled={restrictedTabs}
            onClick={handleRestrictedTabClick}
          >
            <p className="text-sm font-bold tracking-wide">
              {t(lang, "reviewList.profile.tab.saved")}
            </p>
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <ProfileListSkeleton count={skeletonCount} />
      ) : cards.length > 0 ? (
        cards.map((card, index) => (
          <ReviewCardProfile
            key={`profile-${index}`}
            {...card}
            onComment={onReviewComment}
            onReport={onReviewReport}
            onShare={onReviewShare}
            onVote={onReviewVote}
            lang={lang}
          />
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
