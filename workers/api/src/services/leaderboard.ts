import type { ParsedEnv } from "../env";
import { getSupabaseAdminClient, getSupabaseClient } from "../supabase";
import type {
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardTimeframe,
  PaginationInfo,
  UserProfile,
} from "../types";
import { buildPaginationInfo } from "../utils/pagination";
import { mapProfileRow } from "./mappers";

type AggregateRow = {
  user_id: string | null;
  review_count?: number | string | null;
  total_views?: number | string | null;
  total_votes?: number | string | null;
};

type AggregateStats = {
  reviewCount: number;
  totalViews: number;
  totalVotes: number;
};

type LeaderboardAggregate = {
  userId: string;
  allTime: AggregateStats;
  recent: AggregateStats;
  score: number;
};

const RECENT_DAYS_BY_TIMEFRAME: Record<LeaderboardTimeframe, number> = {
  all: 30,
  month: 30,
  week: 7,
};

const FALLBACK_PAGE_SIZE = 1000;
const MAX_FALLBACK_ROWS = 20000;

function normalizeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

function emptyStats(): AggregateStats {
  return {
    reviewCount: 0,
    totalViews: 0,
    totalVotes: 0,
  };
}

async function fetchAllTimeStats(env: ParsedEnv): Promise<Map<string, AggregateStats>> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("leaderboard_user_stats")
    .select("user_id, review_count, total_views, total_votes");

  if (error) {
    return fetchAggregates(env, {});
  }

  const map = new Map<string, AggregateStats>();
  (data ?? []).forEach((row) => {
    const casted = row as AggregateRow;
    if (!casted.user_id) {
      return;
    }
    map.set(casted.user_id, {
      reviewCount: normalizeNumber(casted.review_count),
      totalViews: normalizeNumber(casted.total_views),
      totalVotes: normalizeNumber(casted.total_votes),
    });
  });

  return map;
}

async function fetchAggregates(
  env: ParsedEnv,
  options: { since?: string | null }
): Promise<Map<string, AggregateStats>> {
  const supabase = getSupabaseClient(env);
  let query = supabase
    .from("reviews")
    .select(
      "user_id, review_count:count(), total_views:views.sum(), total_votes:votes_up.sum()"
    )
    .eq("status", "published");

  if (options.since) {
    query = query.gte("created_at", options.since);
  }

  const { data, error } = await query;

  if (error) {
    return fetchAggregatesFallback(env, options);
  }

  const map = new Map<string, AggregateStats>();
  (data ?? []).forEach((row) => {
    const casted = row as AggregateRow;
    if (!casted.user_id) {
      return;
    }
    const existing = map.get(casted.user_id) ?? emptyStats();
    existing.reviewCount += normalizeNumber(casted.review_count);
    existing.totalViews += normalizeNumber(casted.total_views);
    existing.totalVotes += normalizeNumber(casted.total_votes);
    map.set(casted.user_id, existing);
  });

  return map;
}

async function fetchAggregatesFallback(
  env: ParsedEnv,
  options: { since?: string | null }
): Promise<Map<string, AggregateStats>> {
  const supabase = getSupabaseClient(env);
  const map = new Map<string, AggregateStats>();
  let from = 0;
  let totalCount: number | null = null;

  while (true) {
    let query = supabase
      .from("reviews")
      .select("user_id, views, votes_up", { count: "exact" })
      .eq("status", "published");

    if (options.since) {
      query = query.gte("created_at", options.since);
    }

    const { data, error, count } = await query.range(
      from,
      from + FALLBACK_PAGE_SIZE - 1
    );

    if (error) {
      throw error;
    }

    if (totalCount === null) {
      totalCount = count ?? null;
    }

    (data ?? []).forEach((row) => {
      const userId = row.user_id as string | null;
      if (!userId) {
        return;
      }
      const entry = map.get(userId) ?? emptyStats();
      entry.reviewCount += 1;
      entry.totalViews += normalizeNumber(row.views);
      entry.totalVotes += normalizeNumber(row.votes_up);
      map.set(userId, entry);
    });

    if (!data || data.length < FALLBACK_PAGE_SIZE) {
      break;
    }

    from += FALLBACK_PAGE_SIZE;
    if (totalCount !== null && from >= totalCount) {
      break;
    }
    if (from >= MAX_FALLBACK_ROWS) {
      break;
    }
  }

  return map;
}

async function fetchRecentVoteAggregates(
  env: ParsedEnv,
  since: string
): Promise<Map<string, number>> {
  const supabase = getSupabaseClient(env);
  const map = new Map<string, number>();
  let from = 0;
  let totalCount: number | null = null;

  while (true) {
    const { data, error, count } = await supabase
      .from("review_votes")
      .select("review_id, reviews!inner(user_id, status)", { count: "exact" })
      .eq("type", "up")
      .eq("reviews.status", "published")
      .gte("created_at", since)
      .range(from, from + FALLBACK_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    if (totalCount === null) {
      totalCount = count ?? null;
    }

    (data ?? []).forEach((row) => {
      const review = pickRelation(
        row.reviews as { user_id: string | null; status?: string | null } | null
      );
      if (!review || !review.user_id) {
        return;
      }
      const status = review.status ?? "published";
      if (status !== "published") {
        return;
      }
      const current = map.get(review.user_id) ?? 0;
      map.set(review.user_id, current + 1);
    });

    if (!data || data.length < FALLBACK_PAGE_SIZE) {
      break;
    }

    from += FALLBACK_PAGE_SIZE;
    if (totalCount !== null && from >= totalCount) {
      break;
    }
    if (from >= MAX_FALLBACK_ROWS) {
      break;
    }
  }

  return map;
}

async function fetchRecentViewAggregates(
  env: ParsedEnv,
  since: string
): Promise<Map<string, number>> {
  const supabase = getSupabaseClient(env);
  const map = new Map<string, number>();
  let from = 0;
  let totalCount: number | null = null;

  while (true) {
    const { data, error, count } = await supabase
      .from("review_views")
      .select("review_author_id", { count: "exact" })
      .gte("created_at", since)
      .range(from, from + FALLBACK_PAGE_SIZE - 1);

    if (error) {
      console.warn("Failed to fetch review view aggregates:", error.message);
      return map;
    }

    if (totalCount === null) {
      totalCount = count ?? null;
    }

    (data ?? []).forEach((row) => {
      const userId = row.review_author_id as string | null;
      if (!userId) {
        return;
      }
      const current = map.get(userId) ?? 0;
      map.set(userId, current + 1);
    });

    if (!data || data.length < FALLBACK_PAGE_SIZE) {
      break;
    }

    from += FALLBACK_PAGE_SIZE;
    if (totalCount !== null && from >= totalCount) {
      break;
    }
    if (from >= MAX_FALLBACK_ROWS) {
      break;
    }
  }

  return map;
}

function mergeRecentStats(
  reviewStats: Map<string, AggregateStats>,
  voteStats: Map<string, number>,
  viewStats: Map<string, number>
): Map<string, AggregateStats> {
  const map = new Map<string, AggregateStats>();

  reviewStats.forEach((stats, userId) => {
    map.set(userId, {
      reviewCount: stats.reviewCount,
      totalViews: stats.totalViews,
      totalVotes: 0,
    });
  });

  voteStats.forEach((votes, userId) => {
    const existing = map.get(userId) ?? emptyStats();
    existing.totalVotes = votes;
    map.set(userId, existing);
  });

  viewStats.forEach((views, userId) => {
    const existing = map.get(userId) ?? emptyStats();
    existing.totalViews = views;
    map.set(userId, existing);
  });

  return map;
}

function buildScore(
  metric: LeaderboardMetric,
  timeframe: LeaderboardTimeframe,
  allTime: AggregateStats,
  recent: AggregateStats
): number {
  if (metric === "active") {
    return timeframe === "all" ? allTime.reviewCount : recent.reviewCount;
  }
  if (metric === "helpful") {
    return timeframe === "all" ? allTime.totalVotes : recent.totalVotes;
  }

  const base =
    recent.reviewCount * 4 +
    recent.totalVotes * 0.6 +
    recent.totalViews * 0.02;

  return timeframe === "week" ? base * 0.7 : base;
}

function buildRankedEntries(
  metric: LeaderboardMetric,
  timeframe: LeaderboardTimeframe,
  allStats: Map<string, AggregateStats>,
  recentStats: Map<string, AggregateStats>
): LeaderboardAggregate[] {
  const userIds = new Set<string>([
    ...Array.from(allStats.keys()),
    ...Array.from(recentStats.keys()),
  ]);

  const entries: LeaderboardAggregate[] = [];
  userIds.forEach((userId) => {
    const allTime = allStats.get(userId) ?? emptyStats();
    const recent = recentStats.get(userId) ?? emptyStats();
    const score = buildScore(metric, timeframe, allTime, recent);

    if (score <= 0) {
      return;
    }

    entries.push({
      userId,
      allTime,
      recent,
      score,
    });
  });

  entries.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    const voteDiff = b.allTime.totalVotes - a.allTime.totalVotes;
    if (voteDiff !== 0) {
      return voteDiff;
    }
    const reviewDiff = b.allTime.reviewCount - a.allTime.reviewCount;
    if (reviewDiff !== 0) {
      return reviewDiff;
    }
    return a.userId.localeCompare(b.userId);
  });

  return entries;
}

async function fetchProfilesForUsers(
  env: ParsedEnv,
  userIds: string[]
): Promise<Map<string, UserProfile>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, bio, profile_pic_url, created_at")
    .in("user_id", userIds);

  if (error) {
    throw error;
  }

  const map = new Map<string, UserProfile>();
  (data ?? []).forEach((row) => {
    const userId = row.user_id as string | null;
    if (!userId) {
      return;
    }
    map.set(
      userId,
      mapProfileRow(
        row as {
          user_id: string;
          username: string;
          bio: string | null;
          profile_pic_url: string | null;
          created_at: string | null;
        },
        { r2BaseUrl: env.R2_PUBLIC_BASE_URL }
      )
    );
  });

  return map;
}

export async function fetchLeaderboard(
  env: ParsedEnv,
  options: {
    metric: LeaderboardMetric;
    timeframe: LeaderboardTimeframe;
    page: number;
    pageSize: number;
  }
): Promise<{ items: LeaderboardEntry[]; pageInfo: PaginationInfo }> {
  const { metric, timeframe, page, pageSize } = options;
  const recentDays = RECENT_DAYS_BY_TIMEFRAME[timeframe];
  const recentSince = new Date(
    Date.now() - recentDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const [allStats, recentReviewStats, recentVoteStats, recentViewStats] = await Promise.all([
    fetchAllTimeStats(env),
    fetchAggregates(env, { since: recentSince }),
    fetchRecentVoteAggregates(env, recentSince),
    fetchRecentViewAggregates(env, recentSince),
  ]);
  const recentStats = mergeRecentStats(
    recentReviewStats,
    recentVoteStats,
    recentViewStats
  );

  const ranked = buildRankedEntries(metric, timeframe, allStats, recentStats);
  const totalItems = ranked.length;
  const totalPages =
    pageSize > 0 ? Math.ceil(totalItems / pageSize) : 0;
  const safePage =
    totalPages > 0 ? Math.min(Math.max(page, 1), totalPages) : 1;
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize;
  const pageSlice = ranked.slice(from, to);

  const profileMap = await fetchProfilesForUsers(
    env,
    pageSlice.map((entry) => entry.userId)
  );

  const items = pageSlice
    .map((entry, index) => {
      const profile = profileMap.get(entry.userId);
      if (!profile) {
        return null;
      }
      return {
        profile,
        stats: {
          reviewCount: entry.allTime.reviewCount,
          totalViews: entry.allTime.totalViews,
          reputation: entry.allTime.totalVotes,
          helpfulVotes: entry.allTime.totalVotes,
          recentReviewCount: entry.recent.reviewCount,
          recentHelpfulVotes: entry.recent.totalVotes,
          recentViews: entry.recent.totalViews,
        },
        rank: from + index + 1,
      } satisfies LeaderboardEntry;
    })
    .filter(Boolean) as LeaderboardEntry[];

  return {
    items,
    pageInfo: buildPaginationInfo(safePage, pageSize, totalItems),
  };
}

export async function refreshLeaderboardStats(env: ParsedEnv): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdminClient(env);
  if (!supabaseAdmin) {
    console.warn("Leaderboard refresh skipped: SUPABASE_SERVICE_ROLE_KEY missing.");
    return false;
  }

  const { error } = await supabaseAdmin.rpc("refresh_leaderboard_user_stats");
  if (error) {
    console.error("Failed to refresh leaderboard stats:", error.message);
    return false;
  }

  return true;
}
