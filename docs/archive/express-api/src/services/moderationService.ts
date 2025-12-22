import { supabase } from "../db/supabase";
import type { CommentStatus, ReviewStatus } from "../types/api";
import type { UserRole } from "../middleware/auth";

export async function updateReviewStatus(
  id: string,
  status: ReviewStatus
): Promise<{ id: string; slug: string; status: ReviewStatus } | null> {
  const { data, error } = await supabase
    .from("reviews")
    .update({ status })
    .eq("id", id)
    .select("id, slug, status")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    status: data.status as ReviewStatus,
  };
}

export async function updateCommentStatus(
  id: string,
  status: CommentStatus
): Promise<{ id: string; reviewId: string; status: CommentStatus } | null> {
  const { data, error } = await supabase
    .from("comments")
    .update({ status })
    .eq("id", id)
    .select("id, review_id, status")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    reviewId: data.review_id,
    status: data.status as CommentStatus,
  };
}

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<{ userId: string; role: UserRole } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("user_id", userId)
    .select("user_id, role")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    userId: data.user_id,
    role: data.role as UserRole,
  };
}
