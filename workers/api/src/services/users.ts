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
    .select(
      "user_id, username, bio, profile_pic_url, created_at, is_verified, verified_at, verified_by"
    )
    .ilike("username", username)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { data: statsData, error: statsError } = await supabase.rpc(
    "get_user_stats",
    { target_user_id: data.user_id }
  );

  if (statsError) {
    throw statsError;
  }

  const statsRow = Array.isArray(statsData) ? statsData[0] : null;

  const baseProfile = mapProfileRow(
    data as {
      user_id: string;
      username: string;
      bio: string | null;
      profile_pic_url: string | null;
      created_at: string | null;
      is_verified?: boolean | null;
      verified_at?: string | null;
      verified_by?: string | null;
    },
    { r2BaseUrl: env.R2_PUBLIC_BASE_URL }
  );
  const profile: UserProfile = {
    ...baseProfile,
    stats: {
      reviewCount:
        statsRow && Number.isFinite(Number(statsRow.review_count))
          ? Number(statsRow.review_count)
          : undefined,
      totalViews:
        statsRow && Number.isFinite(Number(statsRow.total_views))
          ? Number(statsRow.total_views)
          : undefined,
      reputation:
        statsRow && Number.isFinite(Number(statsRow.total_votes))
          ? Number(statsRow.total_votes)
          : undefined,
      karma:
        statsRow && Number.isFinite(Number(statsRow.total_votes))
          ? Number(statsRow.total_votes)
          : undefined,
      totalComments:
        statsRow && Number.isFinite(Number(statsRow.total_comments))
          ? Number(statsRow.total_comments)
          : undefined,
    },
  };

  return {
    userId: data.user_id,
    profile,
  };
}
