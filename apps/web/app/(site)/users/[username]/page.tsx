import { ReviewListProfile } from "@/components/lists/ReviewList";
export const runtime = "edge";
import type { Metadata } from "next";
import { SidebarProfile } from "@/components/layout/Sidebar";
import type { ReviewCardProfileData } from "@/components/cards/ReviewCard";
import type { ProfilePopularReview } from "@/components/layout/Sidebar";
import type { Category, Review, UserProfile } from "@/src/types";
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
import { getCategories, getUserProfile, getUserReviews } from "@/src/lib/api";
import { buildMetadata } from "@/src/lib/seo";
import {
  profileReviewCards,
  profilePagination,
  profilePopularReviews,
} from "@/data/mock/reviews";
import { profileUser } from "@/data/mock/users";
import { allowMockFallback } from "@/src/lib/runtime";

const DEFAULT_PAGE_SIZE = 10;

export async function generateMetadata({
  params,
}: UserProfilePageProps): Promise<Metadata> {
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
    type: "website",
  });
}

type UserProfilePageProps = {
  params: {
    username: string;
  };
  searchParams?: {
    page?: string;
    pageSize?: string;
    tab?: string;
  };
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

function buildProfileCards(
  reviews: Review[],
  categories: Category[]
): ReviewCardProfileData[] {
  return reviews.map((review, index) => ({
    review,
    dateLabel: formatRelativeTime(review.createdAt),
    ratingStars: buildRatingStars(review.ratingAvg),
    imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
    imageAlt: review.title,
    tagLabel: getCategoryLabel(categories, review.categoryId) ?? "General",
    likesLabel: formatCompactNumber(review.votesUp ?? 0),
    commentsLabel: "0",
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
    viewsLabel: `${formatCompactNumber(review.ratingCount ?? 0)} views`,
  }));
}

function hydrateProfile(
  profile: UserProfile,
  reviews: Review[]
): UserProfile {
  const reviewCount = profile.stats?.reviewCount ?? String(reviews.length);
  const totalViews = profile.stats?.totalViews ?? formatCompactNumber(
    reviews.reduce((total, review) => total + (review.ratingCount ?? 0), 0)
  );
  const reputation = profile.stats?.reputation ?? formatCompactNumber(
    reviews.reduce((total, review) => total + (review.votesUp ?? 0), 0)
  );

  return {
    ...profile,
    profilePicUrl: profile.profilePicUrl ?? pickFrom(FALLBACK_PROFILE_IMAGES, 0),
    stats: {
      ...profile.stats,
      reviewCount,
      totalViews,
      reputation,
      location: profile.stats?.location ?? "",
    },
  };
}

export default async function Page({ params, searchParams }: UserProfilePageProps) {
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const activeTab = parseTab(searchParams?.tab);

  const apiConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
  let baseProfile: UserProfile | null = allowMockFallback ? profileUser : null;
  let reviews: Review[] = allowMockFallback
    ? profileReviewCards.map((card) => card.review)
    : [];
  let reviewCards = allowMockFallback ? profileReviewCards : [];
  let reviewPagination = allowMockFallback
    ? profilePagination
    : { page, pageSize, totalPages: 0, totalItems: 0 };
  let cards = reviewCards;
  let pagination = reviewPagination;
  let reviewCount = allowMockFallback
    ? profilePagination.totalItems ?? profileReviewCards.length
    : 0;
  let popularReviews = allowMockFallback ? profilePopularReviews : [];
  let errorMessage: string | null = null;

  if (apiConfigured) {
    try {
      const [userProfile, userReviews, categories] = await Promise.all([
        getUserProfile(params.username),
        getUserReviews(params.username, page, pageSize),
        getCategories(),
      ]);

      baseProfile = userProfile;
      reviews = userReviews.items;
      reviewCards = buildProfileCards(userReviews.items, categories);
      reviewPagination = userReviews.pageInfo;
      reviewCount = reviewPagination.totalItems ?? userReviews.items.length;
      cards = reviewCards;
      pagination = reviewPagination;
      popularReviews = buildPopularReviews(userReviews.items);
    } catch (error) {
      console.error("Failed to load profile API data", error);
      if (!allowMockFallback) {
        errorMessage = "Unable to load profile data. Please try again later.";
      }
    }
  } else if (!allowMockFallback) {
    errorMessage = "API base URL is not configured.";
  }

  if (activeTab !== "reviews") {
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
  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams(baseParams);
    params.set("tab", activeTab);
    params.set("page", String(targetPage));
    return `?${params.toString()}`;
  };

  return (
    <div
      className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display transition-colors duration-200"
      data-page="user-profile"
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
                    backgroundImage: `url(${profile.profilePicUrl})`,
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
                  Member since November 2021
                </p>
                <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    Top 5% Reviewer
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
                    Beauty Expert
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 w-full md:w-auto justify-center md:justify-end">
              <button className="flex items-center justify-center rounded-lg h-10 px-6 bg-primary hover:bg-primary-dark text-white text-sm font-bold shadow-sm transition-all gap-2 flex-1 md:flex-none">
                <span className="material-symbols-outlined text-[18px]">
                  person_add
                </span>
                <span>Follow</span>
              </button>
              <button className="flex items-center justify-center rounded-lg h-10 px-4 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-background-light dark:hover:bg-background-dark text-text-main-light dark:text-text-main-dark text-sm font-bold transition-all gap-2 flex-1 md:flex-none">
                <span className="material-symbols-outlined text-[18px]">
                  mail
                </span>
                <span>Message</span>
              </button>
              <button className="flex items-center justify-center rounded-lg h-10 w-10 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-background-light dark:hover:bg-background-dark text-text-sub-light dark:text-text-sub-dark transition-all">
                <span className="material-symbols-outlined text-[20px]">
                  more_horiz
                </span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border-light dark:border-border-dark">
            <div className="flex flex-col items-center justify-center">
              <p className="text-text-main-light dark:text-text-main-dark text-xl md:text-2xl font-bold">
                {profile.stats?.reviewCount}
              </p>
              <p className="text-text-sub-light dark:text-text-sub-dark text-xs md:text-sm font-medium uppercase tracking-wide">
                Reviews
              </p>
            </div>
            <div className="flex flex-col items-center justify-center border-l border-r border-border-light dark:border-border-dark">
              <p className="text-text-main-light dark:text-text-main-dark text-xl md:text-2xl font-bold">
                {profile.stats?.totalViews}
              </p>
              <p className="text-text-sub-light dark:text-text-sub-dark text-xs md:text-sm font-medium uppercase tracking-wide">
                Total Views
              </p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-green-600 dark:text-green-400 text-xl md:text-2xl font-bold">
                {profile.stats?.reputation}
              </p>
              <p className="text-text-sub-light dark:text-text-sub-dark text-xs md:text-sm font-medium uppercase tracking-wide">
                Reputation
              </p>
            </div>
          </div>
        </section>
        <div className="flex flex-col lg:flex-row gap-8">
          <SidebarProfile profile={profile} popularReviews={popularReviews} />
          <ReviewListProfile
            cards={cards}
            pagination={pagination}
            activeTab={activeTab}
            reviewCount={reviewCount}
            tabHrefs={{
              reviews: buildTabHref("reviews"),
              drafts: buildTabHref("drafts"),
              comments: buildTabHref("comments"),
              saved: buildTabHref("saved"),
            }}
            buildHref={buildPageHref}
          />
        </div>
      </div>
    </div>
  );
}
