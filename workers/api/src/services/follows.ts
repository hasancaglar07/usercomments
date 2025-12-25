import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import { buildPaginationInfo } from "../utils/pagination";
import type { PaginationInfo } from "../types";

type FollowRow = {
  following_user_id: string;
};

type ProfileRow = {
  user_id: string;
  username: string;
};

export async function fetchFollowingUsers(
  env: ParsedEnv,
  followerUserId: string,
  options: {
    page: number;
    pageSize: number;
    usernames?: string[];
  }
): Promise<{ items: Array<{ username: string }>; pageInfo: PaginationInfo }> {
  const supabase = getSupabaseClient(env);
  const { page, pageSize, usernames } = options;
  const normalizedUsernames =
    usernames?.map((name) => name.trim()).filter(Boolean) ?? [];

  if (normalizedUsernames.length > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("username", normalizedUsernames);

    if (profileError) {
      throw profileError;
    }

    const profiles = (profileData ?? []) as ProfileRow[];
    if (profiles.length === 0) {
      return {
        items: [],
        pageInfo: buildPaginationInfo(page, pageSize, 0),
      };
    }

    const profileMap = new Map(
      profiles.map((profile) => [profile.username.toLowerCase(), profile])
    );
    const profileIds = profiles.map((profile) => profile.user_id);

    const { data: followData, error: followError } = await supabase
      .from("user_follows")
      .select("following_user_id")
      .eq("follower_user_id", followerUserId)
      .in("following_user_id", profileIds);

    if (followError) {
      throw followError;
    }

    const followedIds = new Set(
      ((followData ?? []) as FollowRow[]).map((row) => row.following_user_id)
    );

    const items = normalizedUsernames
      .map((name) => profileMap.get(name.toLowerCase()))
      .filter((profile): profile is ProfileRow => Boolean(profile))
      .filter((profile) => followedIds.has(profile.user_id))
      .map((profile) => ({ username: profile.username }));

    return {
      items,
      pageInfo: buildPaginationInfo(page, pageSize, items.length),
    };
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const { data, error, count } = await supabase
    .from("user_follows")
    .select("following_user_id", { count: "exact" })
    .eq("follower_user_id", followerUserId)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    throw error;
  }

  const followRows = (data ?? []) as FollowRow[];
  const followIds = followRows
    .map((row) => row.following_user_id)
    .filter((id): id is string => Boolean(id));

  if (followIds.length === 0) {
    return {
      items: [],
      pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
    };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, username")
    .in("user_id", followIds);

  if (profileError) {
    throw profileError;
  }

  const profiles = (profileData ?? []) as ProfileRow[];
  const profileMap = new Map(
    profiles.map((profile) => [profile.user_id, profile.username])
  );
  const items = followIds
    .map((id) => profileMap.get(id))
    .filter((username): username is string => Boolean(username))
    .map((username) => ({ username }));

  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, count ?? profiles.length),
  };
}

export async function followUser(
  env: ParsedEnv,
  followerUserId: string,
  followingUserId: string
): Promise<void> {
  const supabase = getSupabaseClient(env);
  const { error } = await supabase.from("user_follows").insert({
    follower_user_id: followerUserId,
    following_user_id: followingUserId,
  });

  if (error && String(error.code) !== "23505") {
    throw error;
  }
}

export async function unfollowUser(
  env: ParsedEnv,
  followerUserId: string,
  followingUserId: string
): Promise<void> {
  const supabase = getSupabaseClient(env);
  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_user_id", followerUserId)
    .eq("following_user_id", followingUserId);

  if (error) {
    throw error;
  }
}
