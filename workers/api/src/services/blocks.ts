import type { ParsedEnv } from "../env";
import { getSupabaseAdminClient, getSupabaseClient } from "../supabase";
import { buildPaginationInfo } from "../utils/pagination";
import type { PaginationInfo } from "../types";

type BlockRow = {
  blocked_user_id: string;
};

type ProfileRow = {
  user_id: string;
  username: string;
};

export async function fetchBlockedUsers(
  env: ParsedEnv,
  blockerUserId: string,
  options: {
    page: number;
    pageSize: number;
    usernames?: string[];
  }
): Promise<{ items: Array<{ username: string }>; pageInfo: PaginationInfo }> {
  const supabase = getSupabaseAdminClient(env) ?? getSupabaseClient(env);
  const { page, pageSize, usernames } = options;
  const normalizedUsernames =
    usernames?.map((name) => name.trim()).filter(Boolean) ?? [];

  if (normalizedUsernames.length > 0) {
    const usernameFilter = normalizedUsernames
      .map((name) => `username.ilike.${name}`)
      .join(",");
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, username")
      .or(usernameFilter);

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

    const { data: blockData, error: blockError } = await supabase
      .from("user_blocks")
      .select("blocked_user_id")
      .eq("blocker_user_id", blockerUserId)
      .in("blocked_user_id", profileIds);

    if (blockError) {
      throw blockError;
    }

    const blockedIds = new Set(
      ((blockData ?? []) as BlockRow[]).map((row) => row.blocked_user_id)
    );

    const items = normalizedUsernames
      .map((name) => profileMap.get(name.toLowerCase()))
      .filter((profile): profile is ProfileRow => Boolean(profile))
      .filter((profile) => blockedIds.has(profile.user_id))
      .map((profile) => ({ username: profile.username }));

    return {
      items,
      pageInfo: buildPaginationInfo(page, pageSize, items.length),
    };
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const { data, error, count } = await supabase
    .from("user_blocks")
    .select("blocked_user_id", { count: "exact" })
    .eq("blocker_user_id", blockerUserId)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    throw error;
  }

  const blockRows = (data ?? []) as BlockRow[];
  const blockedIds = blockRows
    .map((row) => row.blocked_user_id)
    .filter((id): id is string => Boolean(id));

  if (blockedIds.length === 0) {
    return {
      items: [],
      pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
    };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, username")
    .in("user_id", blockedIds);

  if (profileError) {
    throw profileError;
  }

  const profiles = (profileData ?? []) as ProfileRow[];
  const profileMap = new Map(
    profiles.map((profile) => [profile.user_id, profile.username])
  );
  const items = blockedIds
    .map((id) => profileMap.get(id))
    .filter((username): username is string => Boolean(username))
    .map((username) => ({ username }));

  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, count ?? profiles.length),
  };
}

export async function blockUser(
  env: ParsedEnv,
  blockerUserId: string,
  blockedUserId: string
): Promise<void> {
  const supabase = getSupabaseAdminClient(env) ?? getSupabaseClient(env);
  const { error } = await supabase.from("user_blocks").insert({
    blocker_user_id: blockerUserId,
    blocked_user_id: blockedUserId,
  });

  if (error && String(error.code) !== "23505") {
    throw error;
  }
}

export async function unblockUser(
  env: ParsedEnv,
  blockerUserId: string,
  blockedUserId: string
): Promise<void> {
  const supabase = getSupabaseAdminClient(env) ?? getSupabaseClient(env);
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_user_id", blockerUserId)
    .eq("blocked_user_id", blockedUserId);

  if (error) {
    throw error;
  }
}

export async function isBlockedBetween(
  env: ParsedEnv,
  userId: string,
  otherUserId: string
): Promise<boolean> {
  if (userId === otherUserId) {
    return false;
  }
  const supabase = getSupabaseAdminClient(env) ?? getSupabaseClient(env);
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_user_id")
    .in("blocker_user_id", [userId, otherUserId])
    .in("blocked_user_id", [userId, otherUserId])
    .limit(1);

  if (error) {
    throw error;
  }

  return (data ?? []).length > 0;
}
