import ReviewListProfileClient from "@/components/lists/ReviewListProfileClient";
import UserProfileActionsClient from "@/components/user/UserProfileActionsClient";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
import { buildMetadata, toAbsoluteUrl } from "@/src/lib/seo";
import {
  profileReviewCards,
  profilePagination,
  profilePopularReviews,
} from "@/data/mock/reviews";
import { profileUser } from "@/data/mock/users";
import { allowMockFallback } from "@/src/lib/runtime";
import { t } from "@/src/lib/copy";
import {
  getLocale,
  localizePath,
  normalizeLanguage,
  type SupportedLanguage,
} from "@/src/lib/i18n";

export const revalidate = 120;

const DEFAULT_PAGE_SIZE = 10;

export async function generateMetadata(
  props: UserProfilePageProps
): Promise<Metadata> {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  const username = params.username;
  let title = t(lang, "profile.meta.title", { name: username });
  let description = t(lang, "profile.meta.description", { name: username });
  let shouldIndex = true;
  let isMissing = false;

  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    try {
      const profile = await getUserProfile(username);
      const displayName = profile.displayName ?? profile.username;
      title = t(lang, "profile.meta.title", { name: displayName });
      description = profile.bio || t(lang, "profile.meta.description", { name: displayName });
      const reviewCount = profile.stats?.reviewCount ?? 0;
      const hasBio = Boolean(profile.bio && profile.bio.trim().length > 0);
      shouldIndex = reviewCount > 0 || hasBio;
    } catch (error) {
      if (isNotFoundError(error)) {
        isMissing = true;
        shouldIndex = false;
      }
    }
  }

  const metadata = buildMetadata({
    title,
    description,
    path: `/users/${encodeURIComponent(username)}`,
    lang,
    type: "website",
  });
  return shouldIndex && !isMissing
    ? metadata
    : {
      ...metadata,
      robots: {
        index: false,
        follow: true,
      },
    };
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

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }
  const message = String((error as { message?: string }).message ?? "");
  return message.includes("(404") || message.includes(" 404 ");
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

function formatMemberSince(
  value: string | undefined,
  lang: SupportedLanguage
): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(getLocale(lang), {
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildProfileBadges(
  stats: UserProfile["stats"] | undefined,
  lang: SupportedLanguage
): ProfileBadge[] {
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
      label: t(lang, "profile.badge.expertReviewer"),
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20",
    });
  }
  if (reviewCount >= 50) {
    badges.push({
      label: t(lang, "profile.badge.topReviewer"),
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20",
    });
  }
  if (totalViews >= 10000) {
    badges.push({
      label: t(lang, "profile.badge.trendSetter"),
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20",
    });
  }
  if (totalComments >= 100) {
    badges.push({
      label: t(lang, "profile.badge.communityBuilder"),
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20",
    });
  }

  if (badges.length === 0) {
    badges.push({
      label: t(lang, "profile.badge.newReviewer"),
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20",
    });
  }

  return badges.slice(0, 2);
}

function buildProfileCards(
  reviews: Review[],
  categories: Category[],
  lang: SupportedLanguage
): ReviewCardProfileData[] {
  return reviews.map((review, index) => ({
    review,
    href: localizePath(`/content/${review.slug}`, lang),
    dateLabel: formatRelativeTime(review.createdAt, lang),
    ratingStars: buildRatingStars(review.ratingAvg),
    imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
    imageAlt: review.title,
    tagLabel: getCategoryLabel(categories, review.categoryId) ?? t(lang, "common.general"),
    likesLabel: formatCompactNumber(review.votesUp ?? 0, lang),
    commentsLabel: formatCompactNumber(review.commentCount ?? 0, lang),
  }));
}

function buildPopularReviews(
  reviews: Review[],
  lang: SupportedLanguage
): ProfilePopularReview[] {
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
    viewsLabel: t(lang, "reviewDetail.viewsLabel", {
      count: formatCompactNumber(review.views ?? 0, lang),
    }),
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
      popularReviews = buildPopularReviews(userReviews.items, lang);

      if (commentResult) {
        commentCards = buildProfileCards(commentResult.items, categories, lang);
        commentPagination = commentResult.pageInfo;
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        notFound();
      }
      console.error("Failed to load profile API data", error);
      if (!allowMockFallback) {
        errorMessage = t(lang, "profile.error.loadFailed");
      }
    }
  } else if (!allowMockFallback) {
    errorMessage = t(lang, "profile.error.apiNotConfigured");
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
  const memberSince = formatMemberSince(profile.createdAt, lang);
  const memberSinceLabel = memberSince
    ? t(lang, "profile.memberSince", { date: memberSince })
    : t(lang, "profile.memberSince.recent");
  const badges = buildProfileBadges(profile.stats, lang);
  const reviewCountLabel = formatCompactNumber(
    profile.stats?.reviewCount ?? 0,
    lang
  );
  const totalViewsLabel = formatCompactNumber(
    profile.stats?.totalViews ?? 0,
    lang
  );
  const reputationLabel = formatCompactNumber(
    profile.stats?.reputation ?? 0,
    lang
  );
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

  const profileUrl = toAbsoluteUrl(localizePath(`/users/${profile.username}`, lang));
  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${profileUrl}#profile`,
    mainEntity: {
      "@type": "Person",
      name: profile.displayName ?? profile.username,
      identifier: profile.username,
      description: profile.bio || undefined,
      image: profileAvatarUrl ? toAbsoluteUrl(profileAvatarUrl) : undefined,
      interactionStatistic: [
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/WriteAction",
          userInteractionCount: reviewCount,
        },
      ],
    },
  };

  return (
    <UserProfileActionsClient
      username={profile.username}
      userId={profile.userId}
      displayName={profile.displayName ?? profile.username}
    >
      <script type="application/ld+json">
        {JSON.stringify(profileJsonLd)}
      </script>
      <div className="flex-1 w-full max-w-[1200px] mx-auto px-0 md:px-10 py-8 flex flex-col gap-6">
        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {errorMessage}
          </div>
        ) : null}
        <section className="bg-surface-light dark:bg-surface-dark rounded-none md:rounded-xl border-y md:border border-border-light dark:border-border-dark p-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left w-full">
              <div className="relative group">
                <div
                  className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-28 h-28 ring-4 ring-background-light dark:ring-background-dark"
                  data-alt={t(lang, "profile.avatarAlt")}
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
                  {profile.isVerified ? (
                    <span
                      className="material-symbols-outlined text-primary text-[20px]"
                      title={t(lang, "profile.verifiedUser")}
                    >
                      verified
                    </span>
                  ) : null}
                </div>
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm">
                  {memberSinceLabel}
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
            <div className="flex gap-3 w-full md:w-auto justify-center md:justify-end flex-wrap">
              <div data-profile-header-actions className="contents" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border-light dark:border-border-dark">
            <div className="flex flex-col items-center justify-center">
              <p className="text-text-main-light dark:text-text-main-dark text-xl md:text-2xl font-bold">
                {reviewCountLabel}
              </p>
              <p className="text-text-sub-light dark:text-text-sub-dark text-xs md:text-sm font-medium uppercase tracking-wide">
                {t(lang, "profile.stats.reviews")}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center border-l border-r border-border-light dark:border-border-dark">
              <p className="text-text-main-light dark:text-text-main-dark text-xl md:text-2xl font-bold">
                {totalViewsLabel}
              </p>
              <p className="text-text-sub-light dark:text-text-sub-dark text-xs md:text-sm font-medium uppercase tracking-wide">
                {t(lang, "profile.stats.totalViews")}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-green-600 dark:text-green-400 text-xl md:text-2xl font-bold">
                {reputationLabel}
              </p>
              <p className="text-text-sub-light dark:text-text-sub-dark text-xs md:text-sm font-medium uppercase tracking-wide">
                {t(lang, "profile.stats.reputation")}
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
