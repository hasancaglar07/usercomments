import type { ParsedEnv } from "../env";
import { getSupabaseAdminClient, getSupabaseClient } from "../supabase";
import type { AuthUser, UserRole } from "../auth";
import type { UserProfile } from "../types";
import { mapProfileRow } from "./mappers";

const ROLE_VALUES: UserRole[] = ["user", "moderator", "admin"];

function normalizeUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

function buildBaseUsername(user: AuthUser): string {
  const emailBase = user.email?.split("@")[0] ?? "";
  const normalized = normalizeUsername(emailBase);
  if (normalized) {
    return normalized;
  }
  return `user-${user.id.slice(0, 6)}`;
}

export async function ensureProfileForUser(
  env: ParsedEnv,
  user: AuthUser
): Promise<void> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return;
  }

  const base = buildBaseUsername(user);
  const candidates = [base, `${base}-${user.id.slice(0, 6)}`];

  for (const username of candidates) {
    const { error: insertError } = await supabase.from("profiles").insert({
      user_id: user.id,
      username,
    });

    if (!insertError) {
      return;
    }

    if (insertError.code !== "23505") {
      throw insertError;
    }

    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return;
    }
  }

  const fallback = `user-${user.id.slice(0, 8)}`;
  const { error: fallbackError } = await supabase.from("profiles").insert({
    user_id: user.id,
    username: fallback,
  });

  if (fallbackError) {
    throw fallbackError;
  }
}

export async function fetchProfileRole(
  env: ParsedEnv,
  userId: string
): Promise<UserRole> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const role = data?.role;
  if (ROLE_VALUES.includes(role as UserRole)) {
    return role as UserRole;
  }

  return "user";
}

export async function fetchProfileByUserId(
  env: ParsedEnv,
  userId: string
): Promise<{ userId: string; username: string } | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    userId: data.user_id,
    username: data.username,
  };
}

export async function fetchProfileDetailsByUserId(
  env: ParsedEnv,
  userId: string
): Promise<UserProfile | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, bio, profile_pic_url, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapProfileRow(data as {
    user_id: string;
    username: string;
    bio: string | null;
    profile_pic_url: string | null;
    created_at: string | null;
  }, { r2BaseUrl: env.R2_PUBLIC_BASE_URL });
}

export async function updateProfileByUserId(
  env: ParsedEnv,
  userId: string,
  payload: {
    username?: string;
    bio?: string | null;
    profilePicUrl?: string | null;
  },
  options?: { useAdminClient?: boolean }
): Promise<UserProfile | null> {
  const adminClient = options?.useAdminClient
    ? getSupabaseAdminClient(env)
    : null;
  const supabase = adminClient ?? getSupabaseClient(env);
  const updates: Record<string, unknown> = {};
  if (payload.username !== undefined) {
    updates.username = payload.username;
  }
  if (payload.bio !== undefined) {
    updates.bio = payload.bio;
  }
  if (payload.profilePicUrl !== undefined) {
    updates.profile_pic_url = payload.profilePicUrl;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", userId)
    .select("user_id, username, bio, profile_pic_url, created_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapProfileRow(data as {
    user_id: string;
    username: string;
    bio: string | null;
    profile_pic_url: string | null;
    created_at: string | null;
  }, { r2BaseUrl: env.R2_PUBLIC_BASE_URL });
}
