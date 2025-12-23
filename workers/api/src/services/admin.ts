import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import type {
  AdminComment,
  AdminReview,
  AdminUser,
  AdminUserDetail,
  CommentStatus,
  PaginationInfo,
  ReviewStatus,
  UserRole,
} from "../types";
import { buildPaginationInfo } from "../utils/pagination";

type ReviewListResult = {
  items: AdminReview[];
  pageInfo: PaginationInfo;
};

type CommentListResult = {
  items: AdminComment[];
  pageInfo: PaginationInfo;
};

type UserListResult = {
  items: AdminUser[];
  pageInfo: PaginationInfo;
};

type DbAdminReview = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html?: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
  rating_avg?: number | string | null;
  rating_count?: number | string | null;
  views?: number | string | null;
  votes_up?: number | string | null;
  votes_down?: number | string | null;
  photo_urls?: unknown;
  photo_count?: number | string | null;
  comment_count?: number | string | null;
  category_id?: number | string | null;
  sub_category_id?: number | string | null;
  profiles?:
    | {
        username: string | null;
        profile_pic_url?: string | null;
      }
    | {
        username: string | null;
        profile_pic_url?: string | null;
      }[]
    | null;
};

type DbAdminComment = {
  id: string;
  review_id: string;
  text: string | null;
  status: string | null;
  created_at: string;
  profiles?:
    | {
        username: string | null;
        profile_pic_url: string | null;
      }
    | {
        username: string | null;
        profile_pic_url: string | null;
      }[]
    | null;
  reviews?:
    | {
        id: string;
        slug: string;
        title: string | null;
        status: string | null;
      }
    | {
        id: string;
        slug: string;
        title: string | null;
        status: string | null;
      }[]
    | null;
};

type DbAdminUser = {
  user_id: string;
  username: string;
  role: string | null;
  created_at: string | null;
};

type DbAdminUserDetail = DbAdminUser & {
  bio: string | null;
  profile_pic_url: string | null;
};

const adminReviewSelect = `
  id,
  slug,
  title,
  excerpt,
  status,
  created_at,
  updated_at,
  rating_avg,
  rating_count,
  views,
  votes_up,
  votes_down,
  photo_urls,
  photo_count,
  comment_count,
  category_id,
  sub_category_id,
  profiles(username, profile_pic_url)
`;

const adminReviewDetailSelect = `
  ${adminReviewSelect},
  content_html
`;

const adminCommentSelect = `
  id,
  review_id,
  text,
  status,
  created_at,
  profiles(username, profile_pic_url),
  reviews(id, slug, title, status)
`;

function normalizeNumber(
  value: number | string | null | undefined
): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function normalizeReviewStatus(value: string | null | undefined): ReviewStatus {
  if (
    value === "hidden" ||
    value === "deleted" ||
    value === "pending" ||
    value === "draft"
  ) {
    return value;
  }
  return "published";
}

function normalizeCommentStatus(value: string | null | undefined): CommentStatus {
  if (value === "hidden" || value === "deleted") {
    return value;
  }
  return "published";
}

function normalizeUserRole(value: string | null | undefined): UserRole {
  if (value === "admin" || value === "moderator") {
    return value;
  }
  return "user";
}

function mapAdminReviewRow(row: DbAdminReview): AdminReview {
  const profile = pickRelation(row.profiles);
  const ratingAvg = normalizeNumber(row.rating_avg);
  const ratingCount = normalizeNumber(row.rating_count);
  const views = normalizeNumber(row.views);
  const votesUp = normalizeNumber(row.votes_up);
  const votesDown = normalizeNumber(row.votes_down);
  const photoCount = normalizeNumber(row.photo_count);
  const commentCount = normalizeNumber(row.comment_count);
  const categoryId = normalizeNumber(row.category_id);
  const subCategoryId = normalizeNumber(row.sub_category_id);
  const photoUrls = normalizeStringArray(row.photo_urls);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    contentHtml: row.content_html ?? undefined,
    status: normalizeReviewStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    author: {
      username: profile?.username ?? "unknown",
      displayName: profile?.username ?? undefined,
      profilePicUrl: profile?.profile_pic_url ?? undefined,
    },
    ratingAvg,
    ratingCount,
    views,
    votesUp,
    votesDown,
    photoUrls,
    photoCount,
    commentCount,
    categoryId: categoryId ?? undefined,
    subCategoryId: subCategoryId ?? undefined,
  };
}

function mapAdminCommentRow(row: DbAdminComment): AdminComment {
  const profile = pickRelation(row.profiles);
  const review = pickRelation(row.reviews);

  return {
    id: row.id,
    reviewId: row.review_id,
    text: row.text ?? "",
    status: normalizeCommentStatus(row.status),
    createdAt: row.created_at,
    author: {
      username: profile?.username ?? "unknown",
      displayName: profile?.username ?? undefined,
      profilePicUrl: profile?.profile_pic_url ?? undefined,
    },
    review: review
      ? {
          id: review.id,
          slug: review.slug,
          title: review.title ?? "",
          status: normalizeReviewStatus(review.status),
        }
      : undefined,
  };
}

function mapAdminUserRow(row: DbAdminUser): AdminUser {
  return {
    userId: row.user_id,
    username: row.username,
    role: normalizeUserRole(row.role),
    createdAt: row.created_at ?? undefined,
  };
}

function mapAdminUserDetailRow(row: DbAdminUserDetail): AdminUserDetail {
  return {
    userId: row.user_id,
    username: row.username,
    role: normalizeUserRole(row.role),
    createdAt: row.created_at ?? undefined,
    bio: row.bio ?? undefined,
    profilePicUrl: row.profile_pic_url ?? undefined,
  };
}

export async function fetchAdminReviews(
  env: ParsedEnv,
  options: {
    status?: ReviewStatus;
    page: number;
    pageSize: number;
  }
): Promise<ReviewListResult> {
  const supabase = getSupabaseClient(env);
  const { status, page, pageSize } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("reviews")
    .select(adminReviewSelect, { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: (data ?? []).map((row) => mapAdminReviewRow(row as DbAdminReview)),
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function fetchAdminReviewDetail(
  env: ParsedEnv,
  id: string
): Promise<AdminReview | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("reviews")
    .select(adminReviewDetailSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapAdminReviewRow(data as DbAdminReview);
}

export async function updateAdminReview(
  env: ParsedEnv,
  id: string,
  payload: {
    title?: string;
    excerpt?: string;
    contentHtml?: string;
    photoUrls?: string[];
    categoryId?: number | null;
    subCategoryId?: number | null;
  }
): Promise<AdminReview | null> {
  const supabase = getSupabaseClient(env);
  const updates: Record<string, unknown> = {};

  if (payload.title !== undefined) {
    updates.title = payload.title;
  }
  if (payload.excerpt !== undefined) {
    updates.excerpt = payload.excerpt;
  }
  if (payload.contentHtml !== undefined) {
    updates.content_html = payload.contentHtml;
  }
  if (payload.photoUrls !== undefined) {
    updates.photo_urls = payload.photoUrls;
    updates.photo_count = payload.photoUrls.length;
  }
  if (payload.categoryId !== undefined) {
    updates.category_id = payload.categoryId;
  }
  if (payload.subCategoryId !== undefined) {
    updates.sub_category_id = payload.subCategoryId;
  }

  const { data, error } = await supabase
    .from("reviews")
    .update(updates)
    .eq("id", id)
    .select(adminReviewDetailSelect)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapAdminReviewRow(data as DbAdminReview);
}

export async function fetchAdminComments(
  env: ParsedEnv,
  options: {
    status?: CommentStatus;
    reviewId?: string;
    page: number;
    pageSize: number;
  }
): Promise<CommentListResult> {
  const supabase = getSupabaseClient(env);
  const { status, reviewId, page, pageSize } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("comments")
    .select(adminCommentSelect, { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }
  if (reviewId) {
    query = query.eq("review_id", reviewId);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: (data ?? []).map((row) => mapAdminCommentRow(row as DbAdminComment)),
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function updateAdminComment(
  env: ParsedEnv,
  id: string,
  payload: { text: string }
): Promise<AdminComment | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("comments")
    .update({ text: payload.text })
    .eq("id", id)
    .select(adminCommentSelect)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapAdminCommentRow(data as DbAdminComment);
}

export async function fetchAdminUsers(
  env: ParsedEnv,
  options: { page: number; pageSize: number }
): Promise<UserListResult> {
  const supabase = getSupabaseClient(env);
  const { page, pageSize } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("profiles")
    .select("user_id, username, role, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: (data ?? []).map((row) => mapAdminUserRow(row as DbAdminUser)),
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function fetchAdminUserDetail(
  env: ParsedEnv,
  userId: string
): Promise<AdminUserDetail | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, role, bio, profile_pic_url, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapAdminUserDetailRow(data as DbAdminUserDetail);
}
