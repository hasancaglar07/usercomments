import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";
import RecentComments from "@/components/home/RecentComments";
import AuthCtaButton from "@/components/auth/AuthCtaButton";
import PopularReviewsWidget from "@/components/layout/PopularReviewsWidget";
import TopAuthorsWidget from "@/components/layout/TopAuthorsWidget";
import {
  UserProfileAchievementsTrigger,
  UserProfileShareLink,
} from "@/components/user/UserProfileActionsClient";
import type { Category, Review, UserProfile } from "@/src/types";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";
import { DEFAULT_AVATAR } from "@/src/lib/review-utils";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";

export type HomepageTopReviewer = {
  profile: UserProfile;
  avatarUrl: string;
  avatarAlt: string;
  rankLabel: string;
  reviewCountLabel: string;
};

export type SidebarHomepageProps = {
  lang: string;
  topReviewers: HomepageTopReviewer[];
  popularCategories: Category[];
};

export function SidebarHomepage({
  lang,
  topReviewers,
  popularCategories,
}: SidebarHomepageProps) {
  const resolvedLang = normalizeLanguage(lang);
  const leaderboardHref = localizePath("/leaderboard", lang);
  return (
    <div className="w-full lg:w-1/3 flex flex-col gap-6">
      <div className="bg-background-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5">
        <h3 className="text-lg font-bold text-text-main dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">
            workspace_premium
          </span>
          {t(resolvedLang, "sidebar.topReviewers")}
        </h3>
        <div className="flex flex-col gap-4">
          {topReviewers.map((reviewer) => (
            <Link
              key={`${reviewer.profile.username}-${reviewer.rankLabel}`}
              className="flex items-center justify-between group cursor-pointer active-press"
              href={localizePath(
                `/users/${encodeURIComponent(reviewer.profile.username.toLowerCase())}`,
                lang
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 shrink-0">
                  <Image
                    src={getOptimizedImageUrl(reviewer.avatarUrl || DEFAULT_AVATAR, 64)}
                    alt={reviewer.avatarAlt}
                    fill
                    sizes="40px"
                    className="rounded-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-main dark:text-white group-hover:text-primary transition-colors">
                    {reviewer.profile.displayName ?? reviewer.profile.username}
                  </p>
                  <p className="text-xs text-text-muted">
                    {reviewer.reviewCountLabel}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-primary">
                {reviewer.rankLabel}
              </span>
            </Link>
          ))}
        </div>
        <Link
          className="mt-4 block w-full py-2 text-xs font-bold text-primary hover:bg-blue-50 dark:hover:bg-gray-800 rounded transition-colors text-center active-press"
          href={leaderboardHref}
        >
          {t(resolvedLang, "sidebar.viewLeaderboard")}
        </Link>
      </div>
      <div className="bg-gradient-to-br from-primary to-blue-600 rounded-xl p-6 text-white text-center shadow-lg">
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-2xl">
            campaign
          </span>
        </div>
        <h3 className="font-bold text-lg mb-2">
          {t(resolvedLang, "sidebar.joinCommunity")}
        </h3>
        <p className="text-sm text-blue-100 mb-4">
          {t(resolvedLang, "sidebar.joinCommunityDescription")}
        </p>
        <AuthCtaButton className="px-4 py-2 bg-white text-primary text-sm font-bold rounded-lg hover:bg-gray-100 transition-colors shadow-sm">
          {t(resolvedLang, "sidebar.startWriting")}
        </AuthCtaButton>
      </div>
      <div className="bg-background-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5">
        <Suspense fallback={<div className="animate-pulse h-40 bg-gray-100 dark:bg-gray-800 rounded-lg" />}>
          <RecentComments lang={normalizeLanguage(lang)} />
        </Suspense>
      </div>
      <div className="bg-background-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5">
        <h3 className="text-lg font-bold text-text-main dark:text-white mb-4">
          {t(resolvedLang, "sidebar.popularCategories")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {popularCategories.map((category) => (
            <Link
              key={category.id}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active-press"
              href={localizePath(`/catalog/reviews/${category.id}`, lang)}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export type CatalogPopularTopic = {
  slug: string;
  rankLabel: string;
  title: string;
  metaLabel: string;
  thumbnailUrl?: string;
  thumbnailAlt?: string;
};

export type CatalogTopAuthor = {
  profile: UserProfile;
  avatarUrl: string;
  avatarAlt: string;
  avatarDataAlt: string;
  rankLabel: string;
  rankClassName: string;
  reviewsLabel: string;
  karmaLabel: string;
};

export type SidebarCatalogProps = {
  lang: string;
  popularTopics: CatalogPopularTopic[];
  topAuthors: CatalogTopAuthor[];
};

export function SidebarCatalog({ lang, popularTopics, topAuthors }: SidebarCatalogProps) {
  const resolvedLang = normalizeLanguage(lang);
  return (
    <div className="lg:col-span-4 space-y-8">
      <PopularReviewsWidget lang={lang} topics={popularTopics} />
      <TopAuthorsWidget lang={lang} authors={topAuthors} />
      <div className="bg-gradient-to-br from-primary to-blue-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <span className="material-symbols-outlined text-[120px]">
            verified
          </span>
        </div>
        <div className="relative z-10">
          <h3 className="font-bold text-xl mb-2">
            {t(resolvedLang, "sidebar.joinCommunity")}
          </h3>
          <p className="text-blue-100 text-sm mb-4">
            {t(resolvedLang, "sidebar.joinCommunityDescription")}
          </p>
          <AuthCtaButton
            className="bg-white text-primary px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-blue-50 transition-colors w-full"
            authenticatedHref="/node/add/review"
            guestHref="/user/register"
          >
            {t(resolvedLang, "sidebar.signUpFree")}
          </AuthCtaButton>
        </div>
      </div>
    </div>
  );
}

export type CategoryBestItem = {
  review: Review;
  rankLabel: string;
  imageUrl: string;
  imageAlt: string;
  ratingLabel: string;
  ratingCountLabel: string;
};

export type CategoryTopAuthor = {
  profile: UserProfile;
  avatarUrl: string;
  avatarAlt: string;
  reviewsLabel: string;
};

export type SidebarCategoryProps = {
  lang: string;
  bestItems: CategoryBestItem[];
  topAuthors: CategoryTopAuthor[];
  popularTags: Category[];
  baseCategoryId?: number;
};

export function SidebarCategory({
  lang,
  bestItems,
  topAuthors,
  popularTags,
  baseCategoryId,
}: SidebarCategoryProps) {
  const resolvedLang = normalizeLanguage(lang);
  return (
    <aside className="lg:col-span-4 flex flex-col gap-6">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-[#e7edf3]">
        <h3 className="text-[#0d141b] text-lg font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">
            trophy
          </span>
          {t(resolvedLang, "sidebar.bestInCategory")}
        </h3>
        <div className="flex flex-col gap-4">
          {bestItems.map((item) => (
            <Link
              key={item.rankLabel}
              className="flex gap-3 items-center group cursor-pointer active-press"
              href={localizePath(`/content/${item.review.slug}`, lang)}
            >
              <span className="text-xl font-bold text-gray-300 w-6 text-center group-hover:text-primary transition-colors">
                {item.rankLabel}
              </span>
              <div className="relative size-12 shrink-0">
                <Image
                  src={getOptimizedImageUrl(item.imageUrl, 128)}
                  alt={item.imageAlt}
                  fill
                  sizes="48px"
                  className="rounded object-cover border border-[#e7edf3]"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-bold text-[#0d141b] leading-tight group-hover:text-primary transition-colors truncate">
                  {item.review.title}
                </p>
                <div className="flex text-primary text-[14px]">
                  <span className="material-symbols-outlined text-[16px] fill-current">
                    star
                  </span>
                  <span className="font-bold ml-1 text-xs">
                    {item.ratingLabel}
                  </span>
                  <span className="text-[#4c739a] ml-1 text-xs">
                    {item.ratingCountLabel}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <button className="w-full mt-5 py-2 text-sm font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors active-press">
          {t(resolvedLang, "sidebar.viewTop100")}
        </button>
      </div>
      <div className="bg-white p-5 rounded-xl shadow-sm border border-[#e7edf3]">
        <h3 className="text-[#0d141b] text-lg font-bold mb-4">
          {t(resolvedLang, "sidebar.topAuthors")}
        </h3>
        <div className="flex flex-col gap-4">
          {topAuthors.map((author) => (
            <div
              key={author.profile.username}
              className="flex items-center justify-between group"
            >
              <Link
                className="flex items-center gap-3 cursor-pointer active-press"
                href={localizePath(
                  `/users/${encodeURIComponent(author.profile.username.toLowerCase())}`,
                  lang
                )}
              >
                <div className="relative size-10 shrink-0">
                  <Image
                    src={getOptimizedImageUrl(author.avatarUrl || DEFAULT_AVATAR, 64)}
                    alt={author.avatarAlt}
                    fill
                    sizes="40px"
                    className="rounded-full object-cover border border-[#e7edf3]"
                  />
                </div>
                <div className="flex flex-col">
                  <p className="text-sm font-bold text-[#0d141b] group-hover:text-primary transition-colors">
                    {author.profile.displayName ?? author.profile.username}
                  </p>
                  <p className="text-xs text-[#4c739a]">
                    {author.reviewsLabel}
                  </p>
                </div>
              </Link>
              <button className="size-8 rounded-full bg-[#e7edf3] flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors shrink-0 active-press">
                <span className="material-symbols-outlined text-lg">
                  person_add
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white p-5 rounded-xl shadow-sm border border-[#e7edf3]">
        <h3 className="text-[#0d141b] text-lg font-bold mb-4">
          {t(resolvedLang, "sidebar.popularTags")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {popularTags.map((tag) => {
            const href =
              tag.parentId != null && baseCategoryId
                ? `/catalog/reviews/${baseCategoryId}?subCategoryId=${tag.id}`
                : `/catalog/reviews/${tag.id}`;
            return (
              <Link
                key={tag.id}
                className="text-xs font-medium text-[#4c739a] bg-[#f6f7f8] px-3 py-1.5 rounded-md hover:bg-[#e7edf3] transition-colors active-press"
                href={localizePath(href, lang)}
              >
                {tag.name}
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export type ProfilePopularReview = {
  review: Review;
  thumbnailUrl: string;
  thumbnailAlt: string;
  ratingLabel: string;
  viewsLabel: string;
};

export type SidebarProfileProps = {
  lang: string;
  profile: UserProfile;
  popularReviews: ProfilePopularReview[];
};

export function SidebarProfile({ lang, profile, popularReviews }: SidebarProfileProps) {
  const resolvedLang = normalizeLanguage(lang);
  const bio =
    profile.bio && profile.bio.trim().length > 0
      ? profile.bio
      : t(resolvedLang, "sidebar.noBio");
  return (
    <aside className="w-full lg:w-1/3 flex flex-col gap-6 order-2 lg:order-1">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5 shadow-sm">
        <h3 className="text-text-main-light dark:text-text-main-dark font-bold text-lg mb-3">
          {t(resolvedLang, "sidebar.aboutMe")}
        </h3>
        <p className="text-text-sub-light dark:text-text-sub-dark text-sm leading-relaxed mb-4">
          {bio}
        </p>
        <div className="flex flex-wrap gap-2">
          <UserProfileShareLink
            className="flex items-center justify-center w-8 h-8 rounded-full bg-background-light dark:bg-background-dark text-text-sub-light dark:text-text-sub-dark hover:text-primary transition-colors active-press"
            href={localizePath(`/users/${profile.username}`, lang)}
            aria-label={t(resolvedLang, "sidebar.copyProfileLink")}
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
          </UserProfileShareLink>
          <div className="flex items-center text-xs text-text-sub-light dark:text-text-sub-dark gap-1 ml-auto">
            <span className="material-symbols-outlined text-[16px]">
              location_on
            </span>
            <span>{profile.stats?.location}</span>
          </div>
        </div>
      </div>
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5 shadow-sm">
        <h3 className="text-text-main-light dark:text-text-main-dark font-bold text-lg mb-4 flex items-center justify-between">
          {t(resolvedLang, "sidebar.achievements")}
          <UserProfileAchievementsTrigger className="text-xs font-normal text-primary cursor-pointer hover:underline active-press">
            {t(resolvedLang, "sidebar.viewAll")}
          </UserProfileAchievementsTrigger>
        </h3>
        <div className="grid grid-cols-4 gap-2">
          <div
            className="aspect-square rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400"
            title={t(resolvedLang, "sidebar.achievementGoldReviewer")}
          >
            <span className="material-symbols-outlined">military_tech</span>
          </div>
          <div
            className="aspect-square rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400"
            title={t(resolvedLang, "sidebar.achievementConsistentWriter")}
          >
            <span className="material-symbols-outlined">history_edu</span>
          </div>
          <div
            className="aspect-square rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400"
            title={t(resolvedLang, "sidebar.achievementHelpfulHero")}
          >
            <span className="material-symbols-outlined">thumb_up</span>
          </div>
          <div className="aspect-square rounded-lg bg-background-light dark:bg-background-dark border border-dashed border-border-light dark:border-border-dark flex items-center justify-center text-text-sub-light dark:text-text-sub-dark text-xs font-medium">
            +5
          </div>
        </div>
      </div>
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5 shadow-sm sticky top-24">
        <h3 className="text-text-main-light dark:text-text-main-dark font-bold text-lg mb-4">
          {t(resolvedLang, "sidebar.popularReviews")}
        </h3>
        <div className="flex flex-col gap-4">
          {popularReviews.map((item) => (
            <Link
              key={item.review.id}
              className="flex gap-3 items-center group/item active-press"
              href={localizePath(`/content/${item.review.slug}`, lang)}
            >
              <div className="relative w-12 h-12 shrink-0">
                <Image
                  src={getOptimizedImageUrl(item.thumbnailUrl, 128)}
                  alt={item.thumbnailAlt}
                  fill
                  sizes="48px"
                  className="rounded-lg object-cover"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-text-main-light dark:text-text-main-dark text-sm font-semibold truncate group-hover/item:text-primary transition-colors">
                  {item.review.title}
                </p>
                <div className="flex items-center gap-1 text-xs text-text-sub-light dark:text-text-sub-dark">
                  <span className="material-symbols-outlined star-filled text-yellow-400 text-[14px]">
                    star
                  </span>
                  <span>{item.ratingLabel}</span>
                  <span className="mx-1">•</span>
                  <span>{item.viewsLabel}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
