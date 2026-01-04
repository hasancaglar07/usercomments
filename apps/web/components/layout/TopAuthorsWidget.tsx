"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogTopAuthor } from "@/components/layout/Sidebar";
import { followUser, getMyFollowing, unfollowUser } from "@/src/lib/api";
import { ensureAuthLoaded, getAccessToken, getCurrentUser } from "@/src/lib/auth";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";

type TopAuthorsWidgetProps = {
  lang: string;
  authors: CatalogTopAuthor[];
};

type FollowState = Record<string, boolean>;
type PendingState = Record<string, boolean>;

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export default function TopAuthorsWidget({ lang, authors }: TopAuthorsWidgetProps) {
  const router = useRouter();
  const resolvedLang = normalizeLanguage(lang);
  const [followingMap, setFollowingMap] = useState<FollowState>({});
  const [pendingMap, setPendingMap] = useState<PendingState>({});
  const loginHref = localizePath("/user/login", lang);
  const leaderboardHref = localizePath("/leaderboard", lang);

  useEffect(() => {
    let isActive = true;

    const syncFollowState = async () => {
      if (authors.length === 0) {
        if (isActive) {
          setFollowingMap({});
        }
        return;
      }
      try {
        await ensureAuthLoaded();
      } catch {
        // ignore auth init errors
      }
      if (!isActive) {
        return;
      }
      const user = getCurrentUser();
      const token = getAccessToken();
      if (!user || !token) {
        setFollowingMap({});
        return;
      }
      try {
        const usernames = authors
          .map((author) => author.profile.username)
          .filter((username): username is string => Boolean(username))
          .map((username) => normalizeUsername(username));
        const following = await getMyFollowing(token, usernames);
        if (!isActive) {
          return;
        }
        const followingSet = new Set(
          following.map((username) => normalizeUsername(username))
        );
        const nextState: FollowState = {};
        authors.forEach((author) => {
          const key = normalizeUsername(author.profile.username);
          nextState[key] = followingSet.has(key);
        });
        setFollowingMap(nextState);
      } catch (error) {
        console.error("Failed to load following list", error);
        if (isActive) {
          setFollowingMap({});
        }
      }
    };

    syncFollowState();

    return () => {
      isActive = false;
    };
  }, [authors]);

  const handleFollowClick = useCallback(
    async (username: string) => {
      const key = normalizeUsername(username);
      if (pendingMap[key]) {
        return;
      }
      try {
        await ensureAuthLoaded();
      } catch {
        // ignore auth init errors
      }
      const user = getCurrentUser();
      const token = getAccessToken();
      if (!user || !token) {
        router.push(loginHref);
        return;
      }
      const isFollowing = followingMap[key] ?? false;
      const nextState = !isFollowing;
      setFollowingMap((prev) => ({ ...prev, [key]: nextState }));
      setPendingMap((prev) => ({ ...prev, [key]: true }));
      try {
        if (nextState) {
          await followUser(username, token);
        } else {
          await unfollowUser(username, token);
        }
      } catch (error) {
        console.error("Failed to update follow state", error);
        setFollowingMap((prev) => ({ ...prev, [key]: isFollowing }));
      } finally {
        setPendingMap((prev) => ({ ...prev, [key]: false }));
      }
    },
    [followingMap, loginHref, pendingMap, router]
  );

  return (
    <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4">
        {t(resolvedLang, "sidebar.topAuthorsWeek")}
      </h3>
      <div className="space-y-4">
        {authors.map((author) => {
          const key = normalizeUsername(author.profile.username);
          const isFollowing = followingMap[key] ?? false;
          const avatarUrl = getOptimizedImageUrl(author.avatarUrl, 80);
          return (
            <div
              key={author.profile.username}
              className="flex items-center justify-between group"
            >
              <Link
                className="flex items-center gap-3 cursor-pointer"
                href={localizePath(
                  `/users/${encodeURIComponent(author.profile.username.toLowerCase())}`,
                  lang
                )}
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={author.avatarAlt}
                    className="size-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm"
                    data-alt={author.avatarDataAlt}
                    src={avatarUrl}
                    decoding="async"
                    loading="lazy"
                  />
                  <div className={author.rankClassName}>
                    {author.rankLabel}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">
                    {author.profile.displayName ?? author.profile.username}
                  </p>
                  <p className="text-xs text-slate-500">
                    {author.reviewsLabel} • {author.karmaLabel}
                  </p>
                </div>
              </Link>
              <button
                className="text-primary hover:bg-blue-50 dark:hover:bg-slate-800 p-1 rounded transition-colors shrink-0"
                type="button"
                onClick={() => handleFollowClick(author.profile.username)}
                aria-pressed={isFollowing}
                aria-label={
                  isFollowing
                    ? t(resolvedLang, "profileActions.follow.following")
                    : t(resolvedLang, "profileActions.follow.follow")
                }
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isFollowing ? "check" : "person_add"}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <Link
        className="mt-4 block w-full text-xs font-bold text-primary hover:underline text-center"
        href={leaderboardHref}
      >
        {t(resolvedLang, "sidebar.viewLeaderboard")}
      </Link>
    </div>
  );
}
