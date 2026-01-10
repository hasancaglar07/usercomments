import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import { LeaderboardList, getLeaderboardBadges } from "@/components/leaderboard/LeaderboardList";
import type {
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardTimeframe,
  PaginationInfo,
} from "@/src/types";
import { getLeaderboardDirect } from "@/src/lib/api-direct";
import { allowMockFallback } from "@/src/lib/runtime";
import { buildMetadata } from "@/src/lib/seo";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";
import { DEFAULT_AVATAR, formatCompactNumber } from "@/src/lib/review-utils";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";

export const runtime = 'edge';
export const revalidate = 120;

const DEFAULT_METRIC: LeaderboardMetric = "active";
const DEFAULT_TIMEFRAME: LeaderboardTimeframe = "all";
const DEFAULT_PAGE_SIZE = 20;
const MAX_RANKS = 100;
const PODIUM_SIZE = 3;

const METRIC_OPTIONS: Array<{
  key: LeaderboardMetric;
  labelKey: "leaderboard.metric.mostActive" | "leaderboard.metric.mostHelpful" | "leaderboard.metric.trending";
}> = [
    { key: "active", labelKey: "leaderboard.metric.mostActive" },
    { key: "helpful", labelKey: "leaderboard.metric.mostHelpful" },
    { key: "trending", labelKey: "leaderboard.metric.trending" },
  ];

const TIMEFRAME_OPTIONS: Array<{
  key: LeaderboardTimeframe;
  labelKey: "leaderboard.timeframe.allTime" | "leaderboard.timeframe.month" | "leaderboard.timeframe.week";
}> = [
    { key: "all", labelKey: "leaderboard.timeframe.allTime" },
    { key: "month", labelKey: "leaderboard.timeframe.month" },
    { key: "week", labelKey: "leaderboard.timeframe.week" },
  ];

type LeaderboardPageProps = {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{
    metric?: string;
    timeframe?: string;
    page?: string;
  }>;
};

export async function generateMetadata(
  props: LeaderboardPageProps
): Promise<Metadata> {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const metric = parseMetric(searchParams?.metric);
  const timeframe = parseTimeframe(searchParams?.timeframe);
  const page = parseNumber(searchParams?.page, 1);
  const title = t(lang, "leaderboard.meta.title");
  const description = t(lang, "leaderboard.meta.description");
  const metadata = buildMetadata({
    title,
    description,
    path: "/leaderboard",
    lang,
    type: "website",
  });
  const isIndexable =
    metric === DEFAULT_METRIC && timeframe === DEFAULT_TIMEFRAME && page === 1;

  if (!isIndexable) {
    return {
      ...metadata,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  return metadata;
}

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseMetric(value?: string): LeaderboardMetric {
  const normalized = value?.toLowerCase();
  if (normalized === "active" || normalized === "helpful" || normalized === "trending") {
    return normalized;
  }
  return DEFAULT_METRIC;
}

function parseTimeframe(value?: string): LeaderboardTimeframe {
  const normalized = value?.toLowerCase();
  if (normalized === "all" || normalized === "month" || normalized === "week") {
    return normalized;
  }
  return DEFAULT_TIMEFRAME;
}

function buildLeaderboardHref(
  lang: string,
  metric: LeaderboardMetric,
  timeframe: LeaderboardTimeframe,
  page?: number
) {
  const searchParams = new URLSearchParams();
  if (metric !== DEFAULT_METRIC) {
    searchParams.set("metric", metric);
  }
  if (timeframe !== DEFAULT_TIMEFRAME) {
    searchParams.set("timeframe", timeframe);
  }
  if (page && page > 1) {
    searchParams.set("page", String(page));
  }
  const base = localizePath("/leaderboard", lang);
  const query = searchParams.toString();
  return query ? `${base}?${query}` : base;
}

const MOCK_AVATARS = [
  "/stitch_assets/images/img-038.png",
  "/stitch_assets/images/img-039.png",
  "/stitch_assets/images/img-040.png",
  "/stitch_assets/images/img-008.png",
  "/stitch_assets/images/img-009.png",
  "/stitch_assets/images/img-010.png",
  "/stitch_assets/images/img-026.png",
  "/stitch_assets/images/img-027.png",
  "/stitch_assets/images/img-033.png",
  "/stitch_assets/images/img-035.png",
  "/stitch_assets/images/img-037.png",
  "/stitch_assets/images/img-057.png",
];

const MOCK_FIRST_NAMES = [
  "Jessica",
  "David",
  "Anna",
  "Alex",
  "Nora",
  "Ethan",
  "Lucas",
  "Maya",
  "Sophie",
  "Leo",
  "Emma",
  "Diego",
  "Hana",
  "Noah",
  "Elif",
];

const MOCK_LAST_INITIALS = [
  "M",
  "K",
  "S",
  "R",
  "L",
  "T",
  "B",
  "G",
  "D",
  "A",
  "N",
  "P",
];

function buildMockEntries(count: number): LeaderboardEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const first = MOCK_FIRST_NAMES[index % MOCK_FIRST_NAMES.length];
    const last = MOCK_LAST_INITIALS[index % MOCK_LAST_INITIALS.length];
    const suffix = Math.floor(index / MOCK_FIRST_NAMES.length);
    const usernameBase = `${first.toLowerCase()}_${last.toLowerCase()}`;
    const username = suffix > 0 ? `${usernameBase}_${suffix}` : usernameBase;

    const reviewCount = Math.max(18, 1200 - index * 9 - (index % 5) * 2);
    const reputation = Math.max(220, 3200 - index * 18 + (index % 7) * 12);
    const totalViews = Math.max(1400, reputation * 18 + (index % 9) * 140);
    const helpfulVotes = Math.max(120, Math.round(reputation * 0.65));
    const recentReviewCount = Math.max(3, Math.round(reviewCount * 0.12) - (index % 4));
    const recentHelpfulVotes = Math.max(5, Math.round(helpfulVotes * 0.18) - (index % 6));
    const recentViews = Math.max(120, Math.round(totalViews * 0.08) - (index % 8) * 25);

    return {
      profile: {
        username,
        displayName: `${first} ${last}.`,
        profilePicUrl: MOCK_AVATARS[index % MOCK_AVATARS.length],
      },
      stats: {
        reviewCount,
        totalViews,
        reputation,
        helpfulVotes,
        recentReviewCount,
        recentHelpfulVotes,
        recentViews,
      },
    };
  });
}

function scoreEntry(
  entry: LeaderboardEntry,
  metric: LeaderboardMetric,
  timeframe: LeaderboardTimeframe
): number {
  const { reviewCount, reputation, helpfulVotes, recentReviewCount, recentHelpfulVotes, recentViews } = entry.stats;

  if (metric === "active") {
    if (timeframe === "month") {
      return recentReviewCount ?? 0;
    }
    if (timeframe === "week") {
      return Math.round((recentReviewCount ?? 0) * 0.6);
    }
    return reviewCount;
  }

  if (metric === "helpful") {
    if (timeframe === "month") {
      return recentHelpfulVotes ?? 0;
    }
    if (timeframe === "week") {
      return Math.round((recentHelpfulVotes ?? 0) * 0.6);
    }
    return reputation + (helpfulVotes ?? 0) * 0.15;
  }

  const activityScore =
    (recentReviewCount ?? 0) * 4 +
    (recentHelpfulVotes ?? 0) * 0.6 +
    (recentViews ?? 0) * 0.02;
  return timeframe === "week" ? activityScore * 0.7 : activityScore;
}

function sortEntries(
  entries: LeaderboardEntry[],
  metric: LeaderboardMetric,
  timeframe: LeaderboardTimeframe
): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      const scoreDiff = scoreEntry(b, metric, timeframe) - scoreEntry(a, metric, timeframe);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return (b.stats.reputation ?? 0) - (a.stats.reputation ?? 0);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function buildMockLeaderboard(
  metric: LeaderboardMetric,
  timeframe: LeaderboardTimeframe,
  limit: number
) {
  const entries = sortEntries(buildMockEntries(limit), metric, timeframe);
  return {
    items: entries,
    pageInfo: {
      page: 1,
      pageSize: limit,
      totalPages: 1,
      totalItems: entries.length,
    },
  };
}

function getMetricLabel(lang: string, metric: LeaderboardMetric) {
  const resolvedLang = normalizeLanguage(lang);
  const match = METRIC_OPTIONS.find((option) => option.key === metric);
  return match ? t(resolvedLang, match.labelKey) : t(resolvedLang, "leaderboard.metric.mostActive");
}

function getTimeframeLabel(lang: string, timeframe: LeaderboardTimeframe) {
  const resolvedLang = normalizeLanguage(lang);
  const match = TIMEFRAME_OPTIONS.find((option) => option.key === timeframe);
  return match ? t(resolvedLang, match.labelKey) : t(resolvedLang, "leaderboard.timeframe.allTime");
}

function buildListPagination(
  topCount: number,
  requestedPage: number,
  pageSize: number
) {
  const listTotal = Math.max(0, topCount - PODIUM_SIZE);
  if (listTotal === 0) {
    return {
      listTotal,
      totalPages: 1,
      currentPage: 1,
      listStartRank: 0,
      listEndRank: 0,
    };
  }

  const totalPages = Math.max(1, Math.ceil(listTotal / pageSize));
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);
  const listStartRank = PODIUM_SIZE + (currentPage - 1) * pageSize + 1;
  const listEndRank = Math.min(PODIUM_SIZE + currentPage * pageSize, topCount);
  return {
    listTotal,
    totalPages,
    currentPage,
    listStartRank,
    listEndRank,
  };
}

async function fetchLeaderboardRange(
  metric: LeaderboardMetric,
  timeframe: LeaderboardTimeframe,
  lang: string,
  startRank: number,
  endRank: number,
  pageSize: number
): Promise<LeaderboardEntry[]> {
  if (startRank <= 0 || endRank <= 0 || endRank < startRank) {
    return [];
  }

  const startPage = Math.floor((startRank - 1) / pageSize) + 1;
  const endPage = Math.floor((endRank - 1) / pageSize) + 1;
  const pages = startPage === endPage ? [startPage] : [startPage, endPage];
  const results = await Promise.all(
    pages.map((page) =>
      getLeaderboard(metric, timeframe, page, pageSize, normalizeLanguage(lang))
    )
  );
  const items = results.flatMap((result) => result.items);
  return items
    .filter((entry) => {
      const rank = entry.rank ?? 0;
      return rank >= startRank && rank <= endRank;
    })
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
}

function PodiumCard({
  entry,
  rank,
  lang,
  useRecentStats = false,
}: {
  entry: LeaderboardEntry;
  rank: number;
  lang: string;
  useRecentStats?: boolean;
}) {
  const resolvedLang = normalizeLanguage(lang);
  const displayName = entry.profile.displayName ?? entry.profile.username;
  const avatarUrl = entry.profile.profilePicUrl ?? DEFAULT_AVATAR;
  const badges = getLeaderboardBadges(entry, resolvedLang);
  const isWinner = rank === 1;
  const reviewCount = useRecentStats
    ? entry.stats.recentReviewCount ?? entry.stats.reviewCount
    : entry.stats.reviewCount;
  const totalViews = useRecentStats
    ? entry.stats.recentViews ?? entry.stats.totalViews
    : entry.stats.totalViews;
  const reputation = useRecentStats
    ? entry.stats.recentHelpfulVotes ?? entry.stats.reputation
    : entry.stats.reputation;
  const podiumStyles =
    rank === 1
      ? {
        card:
          "bg-gradient-to-br from-amber-100 via-white to-amber-50 border-amber-200 shadow-amber-200/60",
        ring: "ring-2 ring-amber-300",
        rankText: "text-amber-700",
        icon: "🏆",
      }
      : rank === 2
        ? {
          card: "bg-gradient-to-br from-slate-100 via-white to-slate-50 border-slate-200",
          ring: "ring-1 ring-slate-300",
          rankText: "text-slate-600",
          icon: "🥈",
        }
        : {
          card: "bg-gradient-to-br from-orange-100 via-white to-orange-50 border-orange-200",
          ring: "ring-1 ring-orange-300",
          rankText: "text-orange-600",
          icon: "🥉",
        };

  return (
    <div
      className={`relative flex flex-col items-center text-center gap-4 rounded-3xl border p-6 shadow-sm ${podiumStyles.card}`}
    >
      <div className="absolute -top-4 right-6 flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-text-main shadow-sm whitespace-nowrap">
        <span className="text-[16px] leading-none" aria-hidden>
          {podiumStyles.icon}
        </span>
        #{rank}
      </div>
      <div
        className={`relative ${isWinner ? "size-24" : "size-20"} rounded-full overflow-hidden bg-white ${podiumStyles.ring}`}
      >
        <Image
          src={getOptimizedImageUrl(avatarUrl, 144, 80)}
          alt={t(resolvedLang, "leaderboard.avatarAlt", { username: displayName })}
          fill
          sizes="96px"
          className="object-cover"
        />
      </div>
      <div>
        <Link
          href={localizePath(
            `/users/${encodeURIComponent(entry.profile.username)}`,
            resolvedLang
          )}
          className="text-lg font-bold text-text-main hover:text-primary transition-colors"
        >
          {displayName}
        </Link>
        <p className={`text-sm font-semibold ${podiumStyles.rankText}`}>
          {t(resolvedLang, "leaderboard.podium.rankLabel", { rank })}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {badges.map((badge) => (
          <span key={`${entry.profile.username}-${badge.key}`} className={badge.className}>
            {badge.label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 w-full text-xs">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-text-muted">
            {t(resolvedLang, "leaderboard.stats.reviews")}
          </span>
          <span className="text-sm font-bold text-text-main">
            {formatCompactNumber(reviewCount, resolvedLang)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-text-muted">
            {t(resolvedLang, "leaderboard.stats.views")}
          </span>
          <span className="text-sm font-bold text-text-main">
            {formatCompactNumber(totalViews, resolvedLang)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-text-muted">
            {t(resolvedLang, "leaderboard.stats.reputation")}
          </span>
          <span className="text-sm font-bold text-text-main">
            {formatCompactNumber(reputation, resolvedLang)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function LeaderboardPage(props: LeaderboardPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const metric = parseMetric(searchParams?.metric);
  const timeframe = parseTimeframe(searchParams?.timeframe);
  const requestedPage = parseNumber(searchParams?.page, 1);

  let podiumEntries: LeaderboardEntry[] = [];
  let listEntries: LeaderboardEntry[] = [];
  let topCount = 0;
  let listStartRank = 0;
  let pageInfo: PaginationInfo = {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  };
  let errorMessage: string | null = null;
  let hasApiData = false;

  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    try {
      const podiumResult = await getLeaderboardDirect(metric, timeframe, 1, PODIUM_SIZE, lang);
      const totalItems = podiumResult.pageInfo.totalItems ?? podiumResult.items.length;
      topCount = totalItems > 0 ? Math.min(MAX_RANKS, totalItems) : 0;
      const pagination = buildListPagination(topCount, requestedPage, DEFAULT_PAGE_SIZE);
      listStartRank = pagination.listStartRank;
      pageInfo = {
        page: pagination.currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
        totalPages: pagination.totalPages,
        totalItems: pagination.listTotal,
      };

      podiumEntries = podiumResult.items.slice(0, PODIUM_SIZE);
      if (pagination.listTotal > 0) {
        const listResult = await getLeaderboardDirect(
          metric,
          timeframe,
          pagination.currentPage,
          DEFAULT_PAGE_SIZE,
          lang
        );
        listEntries = listResult.items;
      }

      hasApiData = true;
    } catch (error) {
      if (error instanceof Error) {
        console.error("Leaderboard fetch failed:", error.message);
        errorMessage = `${t(lang, "leaderboard.error.loadFailed")} (${error.message})`;
      } else {
        errorMessage = t(lang, "leaderboard.error.loadFailed");
      }
    }
  } else if (!allowMockFallback) {
    errorMessage = t(lang, "leaderboard.error.apiNotConfigured");
  }

  if (!hasApiData && allowMockFallback) {
    const mock = buildMockLeaderboard(metric, timeframe, MAX_RANKS);
    const mockItems = mock.items;
    const totalItems = mock.pageInfo.totalItems ?? mockItems.length;
    topCount = totalItems > 0 ? Math.min(MAX_RANKS, totalItems) : 0;
    const pagination = buildListPagination(topCount, requestedPage, DEFAULT_PAGE_SIZE);
    listStartRank = pagination.listStartRank;
    pageInfo = {
      page: pagination.currentPage,
      pageSize: DEFAULT_PAGE_SIZE,
      totalPages: pagination.totalPages,
      totalItems: pagination.listTotal,
    };

    podiumEntries = mockItems.slice(0, PODIUM_SIZE);
    if (pagination.listTotal > 0) {
      listEntries = mockItems.filter((entry) => {
        const rank = entry.rank ?? 0;
        return rank >= pagination.listStartRank && rank <= pagination.listEndRank;
      });
    }
  }

  const metricLabel = getMetricLabel(lang, metric);
  const timeframeLabel = getTimeframeLabel(lang, timeframe);
  const useRecentStats = timeframe !== "all" || metric === "trending";
  const hasEntries = podiumEntries.length > 0 || listEntries.length > 0;

  return (
    <div
      className="bg-surface-light dark:bg-background-dark font-display text-text-main antialiased min-h-screen flex flex-col"
      data-page="leaderboard-page"
    >
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {errorMessage ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {errorMessage}
          </div>
        ) : null}
        <section className="relative overflow-hidden rounded-3xl border border-border-light dark:border-border-dark bg-gradient-to-br from-primary/10 via-white to-secondary/10 p-6 sm:p-10">
          <div className="absolute -top-16 -right-16 size-40 rounded-full bg-primary/20 blur-3xl" aria-hidden />
          <div className="absolute -bottom-24 -left-10 size-48 rounded-full bg-secondary/20 blur-3xl" aria-hidden />
          <div className="relative space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
              <span className="material-symbols-outlined text-[16px]">social_leaderboard</span>
              {t(lang, "leaderboard.hero.kicker")}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-text-main">
              {t(lang, "leaderboard.hero.title")}
            </h1>
            <p className="text-sm sm:text-base text-text-muted max-w-2xl">
              {t(lang, "leaderboard.hero.subtitle")}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-border-light bg-white px-3 py-1 font-semibold text-text-main shadow-sm">
                <span className="material-symbols-outlined text-[16px]" aria-hidden>
                  insights
                </span>
                {t(lang, "leaderboard.hero.summary", {
                  metric: metricLabel,
                  timeframe: timeframeLabel,
                })}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border-light bg-white px-3 py-1 font-semibold text-text-main shadow-sm">
                <span className="material-symbols-outlined text-[16px]" aria-hidden>
                  groups
                </span>
                {t(lang, "leaderboard.hero.topCount", { count: topCount })}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {METRIC_OPTIONS.map((option) => {
              const isActive = option.key === metric;
              return (
                <Link
                  key={option.key}
                  href={buildLeaderboardHref(lang, option.key, timeframe)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${isActive
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white text-text-main border-border-light hover:border-primary/40"
                    }`}
                >
                  {t(lang, option.labelKey)}
                </Link>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {TIMEFRAME_OPTIONS.map((option) => {
              const isActive = option.key === timeframe;
              return (
                <Link
                  key={option.key}
                  href={buildLeaderboardHref(lang, metric, option.key)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${isActive
                    ? "bg-text-main text-white border-text-main shadow-sm"
                    : "bg-white text-text-main border-border-light hover:border-text-main/30"
                    }`}
                >
                  {t(lang, option.labelKey)}
                </Link>
              );
            })}
          </div>
        </section>

        {!hasEntries ? (
          <div className="mt-10">
            <EmptyState
              title={t(lang, "leaderboard.empty.title")}
              description={t(lang, "leaderboard.empty.description")}
              ctaLabel={t(lang, "leaderboard.empty.cta")}
              authenticatedHref="/node/add/review"
            />
          </div>
        ) : (
          <>
            <section className="mt-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-text-main">
                    {t(lang, "leaderboard.section.podium")}
                  </h2>
                  <p className="text-sm text-text-muted">
                    {t(lang, "leaderboard.section.podiumSubtitle")}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-sm text-text-muted">
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  {t(lang, "leaderboard.section.podiumNote")}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                {podiumEntries[1] ? (
                  <PodiumCard
                    entry={podiumEntries[1]}
                    rank={2}
                    lang={lang}
                    useRecentStats={useRecentStats}
                  />
                ) : null}
                {podiumEntries[0] ? (
                  <PodiumCard
                    entry={podiumEntries[0]}
                    rank={1}
                    lang={lang}
                    useRecentStats={useRecentStats}
                  />
                ) : null}
                {podiumEntries[2] ? (
                  <PodiumCard
                    entry={podiumEntries[2]}
                    rank={3}
                    lang={lang}
                    useRecentStats={useRecentStats}
                  />
                ) : null}
              </div>
            </section>

            {((pageInfo.totalItems ?? 0) > 0) ? (
              <section className="mt-12">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-text-main">
                      {t(lang, "leaderboard.section.topList")}
                    </h2>
                    <p className="text-sm text-text-muted">
                      {t(lang, "leaderboard.section.topListSubtitle")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-text-muted">
                    {t(lang, "leaderboard.section.pageLabel", {
                      page: pageInfo.page,
                      total: pageInfo.totalPages,
                    })}
                  </span>
                </div>
                <LeaderboardList
                  entries={listEntries}
                  lang={lang}
                  startRank={listStartRank || PODIUM_SIZE + 1}
                  useRecentStats={useRecentStats}
                />
                {pageInfo.totalPages > 1 ? (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    {Array.from({ length: pageInfo.totalPages }).map((_, index) => {
                      const page = index + 1;
                      const isActive = page === pageInfo.page;
                      return (
                        <Link
                          key={`leaderboard-page-${page}`}
                          href={buildLeaderboardHref(lang, metric, timeframe, page)}
                          className={`size-10 flex items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${isActive
                            ? "bg-primary text-white border-primary shadow-sm"
                            : "bg-white text-text-main border-border-light hover:border-primary/30"
                            }`}
                        >
                          {page}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
