import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import type { UserProfile } from "../types";
import { mapProfileRow } from "./mappers";

export type UserProfileRecord = {
  userId: string;
  profile: UserProfile;
};

export async function fetchUserProfileRecord(
  env: ParsedEnv,
  username: string
): Promise<UserProfileRecord | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, bio, profile_pic_url")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { count, error: countError } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", data.user_id);

  if (countError) {
    throw countError;
  }

  const baseProfile = mapProfileRow(data as {
    user_id: string;
    username: string;
    bio: string | null;
    profile_pic_url: string | null;
  });
  const profile: UserProfile = {
    ...baseProfile,
    stats: {
      reviewCount: count !== null ? String(count) : undefined,
    },
  };

  return {
    userId: data.user_id,
    profile,
  };
}
