import Image from "next/image";
import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import type { LeaderboardEntry } from "@/src/types";
import { DEFAULT_AVATAR, formatCompactNumber } from "@/src/lib/review-utils";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

type LeaderboardBadge = {
  key: "verified" | "expert" | "rising";
  label: string;
  className: string;
};

export function getLeaderboardBadges(
  entry: LeaderboardEntry,
  lang: string
): LeaderboardBadge[] {
  const resolvedLang = normalizeLanguage(lang);
  const reviewCount = entry.stats.reviewCount ?? 0;
  const reputation = entry.stats.reputation ?? 0;
  const recentReviewCount = entry.stats.recentReviewCount ?? 0;
  const badges: LeaderboardBadge[] = [];

  if (reputation >= 1200) {
    badges.push({
      key: "expert",
      label: t(resolvedLang, "leaderboard.badge.expert"),
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20",
    });
  }

  if (reviewCount >= 15) {
    badges.push({
      key: "verified",
      label: t(resolvedLang, "leaderboard.badge.verified"),
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:border-emerald-400/30",
    });
  }

  if (recentReviewCount >= 5) {
    badges.push({
      key: "rising",
      label: t(resolvedLang, "leaderboard.badge.rising"),
      className:
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-400/10 dark:text-orange-200 dark:border-orange-400/30",
    });
  }

  return badges.slice(0, 2);
}

type LeaderboardListProps = {
  entries: LeaderboardEntry[];
  lang: string;
  startRank?: number;
  useRecentStats?: boolean;
};

export function LeaderboardList({
  entries,
  lang,
  startRank = 1,
  useRecentStats = false,
}: LeaderboardListProps) {
  const resolvedLang = normalizeLanguage(lang);
  return (
    <div className="space-y-3">
      <div className="hidden md:grid grid-cols-[110px,1fr,260px] px-4 text-[11px] uppercase tracking-wide text-text-muted">
        <span>{t(resolvedLang, "leaderboard.list.rank")}</span>
        <span>{t(resolvedLang, "leaderboard.list.user")}</span>
        <span className="text-right">{t(resolvedLang, "leaderboard.list.stats")}</span>
      </div>
      <ul className="space-y-3">
        {entries.map((entry, index) => {
          const rank = entry.rank ?? startRank + index;
          const displayName = entry.profile.displayName ?? entry.profile.username;
          const avatarUrl = entry.profile.profilePicUrl ?? DEFAULT_AVATAR;
          const badges = getLeaderboardBadges(entry, resolvedLang);
          const reviewCount = useRecentStats
            ? entry.stats.recentReviewCount ?? entry.stats.reviewCount
            : entry.stats.reviewCount;
          const totalViews = useRecentStats
            ? entry.stats.recentViews ?? entry.stats.totalViews
            : entry.stats.totalViews;
          const reputation = useRecentStats
            ? entry.stats.recentHelpfulVotes ?? entry.stats.reputation
            : entry.stats.reputation;
          const stats = [
            {
              key: "reviews",
              label: t(resolvedLang, "leaderboard.stats.reviews"),
              value: formatCompactNumber(reviewCount, resolvedLang),
            },
            {
              key: "views",
              label: t(resolvedLang, "leaderboard.stats.views"),
              value: formatCompactNumber(totalViews, resolvedLang),
            },
            {
              key: "reputation",
              label: t(resolvedLang, "leaderboard.stats.reputation"),
              value: formatCompactNumber(reputation, resolvedLang),
            },
          ];

          const rankClass =
            rank <= 10
              ? "bg-gradient-to-br from-primary/15 to-primary/5 text-primary border border-primary/20"
              : "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";

          return (
            <li
              key={`${entry.profile.username}-${rank}`}
              className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-4 shadow-sm"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span
                    className={`size-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${rankClass}`}
                  >
                    #{rank}
                  </span>
                  <div className="relative size-12 rounded-full border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
                    <UserAvatar
                      src={avatarUrl}
                      alt={t(resolvedLang, "leaderboard.avatarAlt", {
                        username: displayName,
                      })}
                      size={48}
                      className="rounded-full"
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <Link
                    href={localizePath(
                      `/users/${encodeURIComponent(entry.profile.username)}`,
                      resolvedLang
                    )}
                    className="font-semibold text-text-main dark:text-white hover:text-primary transition-colors truncate block"
                  >
                    {displayName}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <span key={`${entry.profile.username}-${badge.key}`} className={badge.className}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-right sm:text-left sm:w-[260px]">
                {stats.map((stat) => (
                  <div key={`${entry.profile.username}-${stat.key}`} className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wide text-text-muted">
                      {stat.label}
                    </span>
                    <span className="text-sm font-semibold text-text-main dark:text-white">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
