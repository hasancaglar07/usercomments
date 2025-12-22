import type { Category, Review, UserProfile } from "@/src/types";

export type HomepageTopReviewer = {
  profile: UserProfile;
  avatarUrl: string;
  avatarAlt: string;
  rankLabel: string;
  reviewCountLabel: string;
};

export type SidebarHomepageProps = {
  topReviewers: HomepageTopReviewer[];
  popularCategories: Category[];
};

export function SidebarHomepage({
  topReviewers,
  popularCategories,
}: SidebarHomepageProps) {
  return (
    <div className="w-full lg:w-1/3 flex flex-col gap-6">
      <div className="bg-background-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5">
        <h3 className="text-lg font-bold text-text-main dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">
            workspace_premium
          </span>
          Top Reviewers
        </h3>
        <div className="flex flex-col gap-4">
          {topReviewers.map((reviewer) => (
            <div
              key={`${reviewer.profile.username}-${reviewer.rankLabel}`}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full bg-cover bg-center"
                  data-alt={reviewer.avatarAlt}
                  style={{ backgroundImage: `url(${reviewer.avatarUrl})` }}
                />
                <div>
                  <p className="text-sm font-bold text-text-main dark:text-white">
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
            </div>
          ))}
        </div>
        <button className="w-full mt-4 py-2 text-xs font-bold text-primary hover:bg-blue-50 dark:hover:bg-gray-800 rounded transition-colors">
          View Leaderboard
        </button>
      </div>
      <div className="bg-gradient-to-br from-primary to-blue-600 rounded-xl p-6 text-white text-center shadow-lg">
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-2xl">
            campaign
          </span>
        </div>
        <h3 className="font-bold text-lg mb-2">Join the Community</h3>
        <p className="text-sm text-blue-100 mb-4">
          Share your experiences and help millions of people make better
          choices.
        </p>
        <button className="px-4 py-2 bg-white text-primary text-sm font-bold rounded-lg hover:bg-gray-100 transition-colors shadow-sm">
          Start Writing Now
        </button>
      </div>
      <div className="bg-background-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-5">
        <h3 className="text-lg font-bold text-text-main dark:text-white mb-4">
          Popular Categories
        </h3>
        <div className="flex flex-wrap gap-2">
          {popularCategories.map((category) => (
            <a
              key={category.id}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              href={`/catalog/reviews/${category.id}`}
            >
              {category.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export type CatalogPopularTopic = {
  rankLabel: string;
  title: string;
  metaLabel: string;
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
  popularTopics: CatalogPopularTopic[];
  topAuthors: CatalogTopAuthor[];
};

export function SidebarCatalog({ popularTopics, topAuthors }: SidebarCatalogProps) {
  return (
    <div className="lg:col-span-4 space-y-8">
      <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white">
            Popular Right Now
          </h3>
          <span className="material-symbols-outlined text-secondary">
            local_fire_department
          </span>
        </div>
        <ul className="space-y-4">
          {popularTopics.map((topic) => (
            <li
              key={topic.rankLabel}
              className="flex gap-3 items-start group cursor-pointer"
            >
              <div className="text-2xl font-black text-slate-200 dark:text-slate-700 leading-none group-hover:text-primary transition-colors">
                {topic.rankLabel}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">
                  {topic.title}
                </h4>
                <p className="text-xs text-slate-500 mt-1">{topic.metaLabel}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4">
          Top Authors of the Week
        </h3>
        <div className="space-y-4">
          {topAuthors.map((author) => (
            <div
              key={author.profile.username}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    alt={author.avatarAlt}
                    className="size-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm"
                    data-alt={author.avatarDataAlt}
                    src={author.avatarUrl}
                  />
                  <div className={author.rankClassName}>
                    {author.rankLabel}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {author.profile.displayName ?? author.profile.username}
                  </p>
                  <p className="text-xs text-slate-500">
                    {author.reviewsLabel} • {author.karmaLabel}
                  </p>
                </div>
              </div>
              <button className="text-primary hover:bg-blue-50 dark:hover:bg-slate-800 p-1 rounded transition-colors">
                <span className="material-symbols-outlined text-[20px]">
                  person_add
                </span>
              </button>
            </div>
          ))}
        </div>
        <button className="w-full mt-4 text-xs font-bold text-primary hover:underline">
          View Leaderboard
        </button>
      </div>
      <div className="bg-gradient-to-br from-primary to-blue-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <span className="material-symbols-outlined text-[120px]">
            verified
          </span>
        </div>
        <div className="relative z-10">
          <h3 className="font-bold text-xl mb-2">Join the Community</h3>
          <p className="text-blue-100 text-sm mb-4">
            Share your experiences and help millions make better choices.
          </p>
          <button className="bg-white text-primary px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-blue-50 transition-colors w-full">
            Sign Up Free
          </button>
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
  bestItems: CategoryBestItem[];
  topAuthors: CategoryTopAuthor[];
  popularTags: Category[];
  baseCategoryId?: number;
};

export function SidebarCategory({
  bestItems,
  topAuthors,
  popularTags,
  baseCategoryId,
}: SidebarCategoryProps) {
  return (
    <aside className="lg:col-span-4 flex flex-col gap-6">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-[#e7edf3]">
        <h3 className="text-[#0d141b] text-lg font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">
            trophy
          </span>
          Best in Category
        </h3>
        <div className="flex flex-col gap-4">
          {bestItems.map((item) => (
            <div
              key={item.rankLabel}
              className="flex gap-3 items-center group cursor-pointer"
            >
              <span className="text-xl font-bold text-gray-300 w-6 text-center group-hover:text-primary">
                {item.rankLabel}
              </span>
              <div
                className="size-12 rounded bg-cover bg-center shrink-0 border border-[#e7edf3]"
                data-alt={item.imageAlt}
                style={{ backgroundImage: `url(${item.imageUrl})` }}
              />
              <div className="flex flex-col">
                <p className="text-sm font-bold text-[#0d141b] leading-tight group-hover:text-primary">
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
            </div>
          ))}
        </div>
        <button className="w-full mt-5 py-2 text-sm font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors">
          View Top 100
        </button>
      </div>
      <div className="bg-white p-5 rounded-xl shadow-sm border border-[#e7edf3]">
        <h3 className="text-[#0d141b] text-lg font-bold mb-4">
          Top Authors
        </h3>
        <div className="flex flex-col gap-4">
          {topAuthors.map((author) => (
            <div
              key={author.profile.username}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="size-10 rounded-full bg-cover bg-center"
                  data-alt={author.avatarAlt}
                  style={{ backgroundImage: `url(${author.avatarUrl})` }}
                />
                <div className="flex flex-col">
                  <p className="text-sm font-bold text-[#0d141b]">
                    {author.profile.displayName ?? author.profile.username}
                  </p>
                  <p className="text-xs text-[#4c739a]">
                    {author.reviewsLabel}
                  </p>
                </div>
              </div>
              <button className="size-8 rounded-full bg-[#e7edf3] flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors">
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
          Popular Tags
        </h3>
        <div className="flex flex-wrap gap-2">
          {popularTags.map((tag) => {
            const href =
              tag.parentId && baseCategoryId
                ? `/catalog/reviews/${baseCategoryId}?subCategoryId=${tag.id}`
                : `/catalog/reviews/${tag.id}`;
            return (
              <a
                key={tag.id}
                className="text-xs font-medium text-[#4c739a] bg-[#f6f7f8] px-3 py-1.5 rounded-md hover:bg-[#e7edf3] transition-colors"
                href={href}
              >
                {tag.name}
              </a>
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
  profile: UserProfile;
  popularReviews: ProfilePopularReview[];
};

export function SidebarProfile({ profile, popularReviews }: SidebarProfileProps) {
  return (
    <aside className="w-full lg:w-1/3 flex flex-col gap-6 order-2 lg:order-1">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5 shadow-sm">
        <h3 className="text-text-main-light dark:text-text-main-dark font-bold text-lg mb-3">
          About Me
        </h3>
        <p className="text-text-sub-light dark:text-text-sub-dark text-sm leading-relaxed mb-4">
          {profile.bio}
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            className="flex items-center justify-center w-8 h-8 rounded-full bg-background-light dark:bg-background-dark text-text-sub-light dark:text-text-sub-dark hover:text-primary transition-colors"
            href={`/users/${profile.username}`}
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
          </a>
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
          Achievements
          <span className="text-xs font-normal text-primary cursor-pointer hover:underline">
            View All
          </span>
        </h3>
        <div className="grid grid-cols-4 gap-2">
          <div
            className="aspect-square rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400"
            title="Gold Reviewer"
          >
            <span className="material-symbols-outlined">military_tech</span>
          </div>
          <div
            className="aspect-square rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400"
            title="Consistent Writer"
          >
            <span className="material-symbols-outlined">history_edu</span>
          </div>
          <div
            className="aspect-square rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400"
            title="Helpful Hero"
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
          Popular Reviews
        </h3>
        <div className="flex flex-col gap-4">
          {popularReviews.map((item) => (
            <a
              key={item.review.id}
              className="flex gap-3 items-center group/item"
              href={`/content/${item.review.slug}`}
            >
              <div
                className="w-12 h-12 rounded-lg bg-cover bg-center shrink-0"
                data-alt={item.thumbnailAlt}
                style={{ backgroundImage: `url(${item.thumbnailUrl})` }}
              />
              <div className="flex flex-col min-w-0">
                <p className="text-text-main-light dark:text-text-main-dark text-sm font-semibold truncate group-hover/item:text-primary transition-colors">
                  {item.review.title}
                </p>
                <div className="flex items-center gap-1 text-xs text-text-sub-light dark:text-text-sub-dark">
                  <span className="material-symbols-filled text-yellow-400 text-[14px]">
                    star
                  </span>
                  <span>{item.ratingLabel}</span>
                  <span className="mx-1">•</span>
                  <span>{item.viewsLabel}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}
