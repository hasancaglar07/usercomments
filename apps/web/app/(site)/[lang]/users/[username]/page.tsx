import ReviewListProfileClient from "@/components/lists/ReviewListProfileClient";
import UserProfileActionsClient, {
  UserProfileHeaderActions,
} from "@/components/user/UserProfileActionsClient";
import type { Metadata } from "next";
import { SidebarProfile } from "@/components/layout/Sidebar";
import type { ReviewCardProfileData } from "@/components/cards/ReviewCard";
import type { ProfilePopularReview } from "@/components/layout/Sidebar";
import type { Category, PaginationInfo, Review, UserProfile } from "@/src/types";
import {
  FALLBACK_PROFILE_IMAGES,
  FALLBACK_REVIEW_IMAGES,
  FALLBACK_THUMBNAILS,
  buildRatingStars,
  formatCompactNumber,
  formatRelativeTime,
  getCategoryLabel,
  pickFrom,
} from "@/src/lib/review-utils";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";
import {
  getCategories,
  getUserComments,
  getUserProfile,
  getUserReviews,
} from "@/src/lib/api";
import { buildMetadata } from "@/src/lib/seo";
import {
  profileReviewCards,
  profilePagination,
  profilePopularReviews,
} from "@/data/mock/reviews";
import { profileUser } from "@/data/mock/users";
import { allowMockFallback } from "@/src/lib/runtime";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";

export const revalidate = 120;

const DEFAULT_PAGE_SIZE = 10;

export async function generateMetadata(
  props: UserProfilePageProps
): Promise<Metadata> {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  const username = params.username;
  let title = `${username} Profile`;
  let description = `View ${username}'s reviews and profile.`;

  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    try {
      const profile = await getUserProfile(username);
      const displayName = profile.displayName ?? profile.username;
      title = `${displayName} Profile`;
      if (profile.bio) {
        description = profile.bio;
      }
    } catch {
      // keep defaults
    }
  }

  return buildMetadata({
    title,
    description,
    path: `/users/${encodeURIComponent(username)}`,
    lang,
    type: "website",
  });
}

type UserProfilePageProps = {
  params: Promise<{
    lang: string;
    username: string;
  }>;
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    tab?: string;
  }>;
};

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

type ProfileTab = "reviews" | "drafts" | "comments" | "saved";

const PROFILE_TABS = new Set<ProfileTab>([
  "reviews",
  "drafts",
  "comments",
  "saved",
]);

function parseTab(value?: string): ProfileTab {
  if (value && PROFILE_TABS.has(value as ProfileTab)) {
    return value as ProfileTab;
  }
  return "reviews";
}

type ProfileBadge = {
  label: string;
  className: string;
};

function formatMemberSince(value?: string): string {
  if (!value) {
    return "recently";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildProfileBadges(stats?: UserProfile["stats"]): ProfileBadge[] {
  if (!stats) {
    return [];
  }

  const badges: ProfileBadge[] = [];
  const karma = stats.karma ?? stats.reputation ?? 0;
  const reviewCount = stats.reviewCount ?? 0;
  const totalViews = stats.totalViews ?? 0;
  const totalComments = stats.totalComments ?? 0;

  if (karma >= 1000) {
    badges.push({
      label: "Expert Reviewer",
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20",
    });
  }
  if (reviewCount >= 50) {
    badges.push({
      label: "Top 5% Reviewer",
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20",
    });
  }
  if (totalViews >= 10000) {
    badges.push({
      label: "Trend Setter",
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20",
    });
  }
  if (totalComments >= 100) {
    badges.push({
      label: "Community Builder",
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20",
    });
  }

  if (badges.length === 0) {
    badges.push({
      label: "New Reviewer",
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20",
    });
  }

  return badges.slice(0, 2);
}

function buildProfileCards(
  reviews: Review[],
  categories: Category[],
  lang: string
): ReviewCardProfileData[] {
  return reviews.map((review, index) => ({
    review,
    href: localizePath(`/content/${review.slug}`, lang),
    dateLabel: formatRelativeTime(review.createdAt),
    ratingStars: buildRatingStars(review.ratingAvg),
    imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
    imageAlt: review.title,
    tagLabel: getCategoryLabel(categories, review.categoryId) ?? "General",
    likesLabel: formatCompactNumber(review.votesUp ?? 0),
    commentsLabel: formatCompactNumber(review.commentCount ?? 0),
  }));
}

function buildPopularReviews(reviews: Review[]): ProfilePopularReview[] {
  const sorted = [...reviews].sort((a, b) => {
    const left = a.votesUp ?? 0;
    const right = b.votesUp ?? 0;
    return right - left;
  });

  return sorted.slice(0, 3).map((review, index) => ({
    review,
    thumbnailUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_THUMBNAILS, index),
    thumbnailAlt: review.title,
    ratingLabel: (review.ratingAvg ?? 0).toFixed(1),
    viewsLabel: `${formatCompactNumber(review.views ?? 0)} views`,
  }));
}

function hydrateProfile(profile: UserProfile, reviews: Review[]): UserProfile {
  const reviewCount =
    profile.stats?.reviewCount ?? reviews.length;
  const totalViews =
    profile.stats?.totalViews ??
    reviews.reduce((total, review) => total + (review.views ?? 0), 0);
  const reputation =
    profile.stats?.reputation ??
    reviews.reduce((total, review) => total + (review.votesUp ?? 0), 0);
  const totalComments =
    profile.stats?.totalComments ??
    reviews.reduce((total, review) => total + (review.commentCount ?? 0), 0);

  return {
    ...profile,
    profilePicUrl: profile.profilePicUrl ?? pickFrom(FALLBACK_PROFILE_IMAGES, 0),
    stats: {
      ...profile.stats,
      reviewCount,
      totalViews,
      reputation,
      karma: profile.stats?.karma ?? reputation,
      totalComments,
      location: profile.stats?.location ?? "",
    },
  };
}

export default async function Page(props: UserProfilePageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const activeTab = parseTab(searchParams?.tab);

  const apiConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
  let baseProfile: UserProfile | null = allowMockFallback ? profileUser : null;
  let categories: Category[] = [];
  let reviews: Review[] = allowMockFallback
    ? profileReviewCards.map((card) => card.review)
    : [];
  let reviewCards = allowMockFallback ? profileReviewCards : [];
  let reviewPagination = allowMockFallback
    ? profilePagination
    : { page, pageSize, totalPages: 0, totalItems: 0 };
  let commentCards: ReviewCardProfileData[] = [];
  let commentPagination: PaginationInfo = {
    page,
    pageSize,
    totalPages: 1,
    totalItems: 0,
  };
  let cards = reviewCards;
  let pagination = reviewPagination;
  let reviewCount = allowMockFallback
    ? profilePagination.totalItems ?? profileReviewCards.length
    : 0;
  let popularReviews = allowMockFallback ? profilePopularReviews : [];
  let errorMessage: string | null = null;

  if (apiConfigured) {
    try {
      const commentsPromise =
        activeTab === "comments"
          ? getUserComments(params.username, page, pageSize, lang)
          : Promise.resolve(null);
      const [userProfile, userReviews, categoryItems, commentResult] =
        await Promise.all([
          getUserProfile(params.username),
          getUserReviews(params.username, page, pageSize, lang),
          getCategories(lang),
          commentsPromise,
        ]);

      baseProfile = userProfile;
      categories = categoryItems;
      reviews = userReviews.items;
      reviewCards = buildProfileCards(userReviews.items, categories, lang);
      reviewPagination = userReviews.pageInfo;
      reviewCount = reviewPagination.totalItems ?? userReviews.items.length;
      popularReviews = buildPopularReviews(userReviews.items);

      if (commentResult) {
        commentCards = buildProfileCards(commentResult.items, categories, lang);
        commentPagination = commentResult.pageInfo;
      }
    } catch (error) {
      console.error("Failed to load profile API data", error);
      if (!allowMockFallback) {
        errorMessage = "Unable to load profile data. Please try again later.";
      }
    }
  } else if (!allowMockFallback) {
    errorMessage = "API base URL is not configured.";
  }

  if (activeTab === "reviews") {
    cards = reviewCards;
    pagination = reviewPagination;
  } else if (activeTab === "comments") {
    cards = commentCards;
    pagination = commentPagination;
  } else {
    cards = [];
    pagination = { page, pageSize, totalPages: 1, totalItems: 0 };
  }

  if (!baseProfile) {
    baseProfile = {
      username: params.username,
      displayName: params.username,
      bio: "",
    };
  }

  const profile = hydrateProfile(baseProfile, reviews);
  const profileAvatarUrl = getOptimizedImageUrl(
    profile.profilePicUrl ?? pickFrom(FALLBACK_PROFILE_IMAGES, 0),
    200
  );
  reviewCount = profile.stats?.reviewCount ?? reviewCount;
  const memberSince = formatMemberSince(profile.createdAt);
  const badges = buildProfileBadges(profile.stats);
  const reviewCountLabel = formatCompactNumber(profile.stats?.reviewCount ?? 0);
  const totalViewsLabel = formatCompactNumber(profile.stats?.totalViews ?? 0);
  const reputationLabel = formatCompactNumber(profile.stats?.reputation ?? 0);
  const baseParams = new URLSearchParams();
  if (pageSize !== DEFAULT_PAGE_SIZE) {
    baseParams.set("pageSize", String(pageSize));
  }
  const buildTabHref = (tab: ProfileTab) => {
    const params = new URLSearchParams(baseParams);
    params.set("tab", tab);
    params.set("page", "1");
    return `?${params.toString()}`;
  };

  return (
    <UserProfileActionsClient
      username={profile.username}
      displayName={profile.displayName ?? profile.username}
    >
      <div className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-10 py-8 flex flex-col gap-6">
        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {errorMessage}
          </div>
        ) : null}
        <section className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left w-full">
              <div className="relative group">
                <div
                  className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-28 h-28 ring-4 ring-background-light dark:ring-background-dark"
                  data-alt="Large user profile avatar"
                  style={{
                    backgroundImage: `url(${profileAvatarUrl})`,
                  }}
                />
                <div className="absolute bottom-1 right-1 bg-green-500 rounded-full w-4 h-4 border-2 border-white dark:border-surface-dark" />
              </div>
              <div className="flex flex-col justify-center gap-1">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <h1 className="text-text-main-light dark:text-text-main-dark text-2xl font-bold leading-tight">
                    {profile.displayName ?? profile.username}
                  </h1>
                  <span
                    className="material-symbols-outlined text-primary text-[20px]"
                    title="Verified User"
                  >
                    verified
                  </span>
                </div>
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm">
                  Member since {memberSince}
                </p>
                {badges.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                    {badges.map((badge) => (
                      <span key={badge.label} className={badge.className}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex gap-3 w-full md:w-auto justify-center md:justify-end">
              <UserProfileHeaderActions />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border-light dark:border-border-dark">
            <div className="flex flex-col items-center justify-center">
              <p className="text-text-main-light dark:text-text-main-dark text-xl md:text-2xl font-bold">
                {reviewCountLabel}
              </p>
              <p className="text-text-sub-light dark:text-text-sub-dark text-xs md:text-sm font-medium uppercase tracking-wide">
                Reviews
              </p>
            </div>
            <div className="flex flex-col items-center justify-center border-l border-r border-border-light dark:border-border-dark">
              <p className="text-text-main-light dark:text-text-main-dark text-xl md:text-2xl font-bold">
                {totalViewsLabel}
              </p>
              <p className="text-text-sub-light dark:text-text-sub-dark text-xs md:text-sm font-medium uppercase tracking-wide">
                Total Views
              </p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-green-600 dark:text-green-400 text-xl md:text-2xl font-bold">
                {reputationLabel}
              </p>
              <p className="text-text-sub-light dark:text-text-sub-dark text-xs md:text-sm font-medium uppercase tracking-wide">
                Reputation
              </p>
            </div>
          </div>
        </section>
        <div className="flex flex-col lg:flex-row gap-8">
          <SidebarProfile
            lang={lang}
            profile={profile}
            popularReviews={popularReviews}
          />
          <ReviewListProfileClient
            username={params.username}
            activeTab={activeTab}
            initialCards={cards}
            initialPagination={pagination}
            reviewCount={reviewCount}
            tabHrefs={{
              reviews: buildTabHref("reviews"),
              drafts: buildTabHref("drafts"),
              comments: buildTabHref("comments"),
              saved: buildTabHref("saved"),
            }}
            page={page}
            pageSize={pageSize}
            categories={categories}
          />
        </div>
      </div>
    </UserProfileActionsClient>
  );
}
