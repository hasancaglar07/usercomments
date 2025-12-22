import { supabase } from "../db/supabase";
import type { AuthUser, UserRole } from "../middleware/auth";

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

export async function ensureProfileForUser(user: AuthUser): Promise<void> {
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

export async function fetchProfileRole(userId: string): Promise<UserRole> {
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

export async function fetchProfileByUserId(userId: string): Promise<{
  userId: string;
  username: string;
} | null> {
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
