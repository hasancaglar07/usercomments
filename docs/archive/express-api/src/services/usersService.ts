import { supabase } from "../db/supabase";
import type { UserProfile } from "../types/api";
import { mapProfileRow } from "./mappers";

export type UserProfileRecord = {
  userId: string;
  profile: UserProfile;
};

export async function fetchUserProfileRecord(
  username: string
): Promise<UserProfileRecord | null> {
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

  const baseProfile = mapProfileRow(data);
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
