import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import type { Comment, PaginationInfo, Review, ReviewStatus } from "../types";
import { buildPaginationInfo } from "../utils/pagination";
import { slugify } from "../utils/slug";
import { mapCommentRow, mapReviewRow } from "./mappers";

type ReviewSort = "latest" | "popular" | "rating";

type ReviewListResult = {
  items: Review[];
  pageInfo: PaginationInfo;
};

type CursorResult<T> = {
  items: T[];
  nextCursor: string | null;
};

type DbReviewRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html?: string | null;
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
};

type ReviewWithCountRow = DbReviewRow & {
  total_count?: number | string | null;
};

const HIDDEN_REVIEW_TITLE = "Review not available";
const HIDDEN_REVIEW_EXCERPT = "This review is currently unavailable.";

const reviewListSelect = `
  id,
  slug,
  title,
  excerpt,
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
  created_at,
  profiles(username, profile_pic_url)
`;

const reviewDetailSelect = `
  ${reviewListSelect},
  content_html,
  status
`;

type CreateReviewPayload = {
  title: string;
  excerpt: string;
  contentHtml: string;
  rating: number;
  categoryId: number;
  subCategoryId?: number | null;
  photoUrls: string[];
  userId: string;
};

export async function fetchPopularReviews(
  env: ParsedEnv,
  limit: number
): Promise<Review[]> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("reviews")
    .select(reviewListSelect)
    .eq("status", "published")
    .order("votes_up", { ascending: false })
    .order("views", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapReviewRow);
}

export async function fetchLatestReviews(
  env: ParsedEnv,
  cursor: string | null,
  limit: number
): Promise<CursorResult<Review>> {
  const supabase = getSupabaseClient(env);
  let query = supabase
    .from("reviews")
    .select(reviewListSelect)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const items = (data ?? []).map(mapReviewRow);
  const nextCursor = items.length > 0 ? items[items.length - 1].createdAt : null;

  return { items, nextCursor };
}

export async function fetchReviews(
  env: ParsedEnv,
  options: {
    categoryId?: number;
    subCategoryId?: number;
    sort: ReviewSort;
    page: number;
    pageSize: number;
  }
): Promise<ReviewListResult> {
  const supabase = getSupabaseClient(env);
  const { categoryId, subCategoryId, sort, page, pageSize } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("reviews").select(reviewListSelect, { count: "exact" });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (subCategoryId) {
    query = query.eq("sub_category_id", subCategoryId);
  }

  switch (sort) {
    case "popular":
      query = query.order("votes_up", { ascending: false });
      break;
    case "rating":
      query = query
        .order("rating_avg", { ascending: false })
        .order("rating_count", { ascending: false });
      break;
    case "latest":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  query = query.eq("status", "published");

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: (data ?? []).map(mapReviewRow),
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function fetchReviewBySlug(
  env: ParsedEnv,
  slug: string
): Promise<Review | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("reviews")
    .select(reviewDetailSelect)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  if (data.status === "deleted") {
    return null;
  }

  if (data.status === "hidden") {
    return buildHiddenReview(data as {
      id: string;
      slug: string;
      created_at: string;
      profiles?:
      | { username: string | null; profile_pic_url: string | null }
      | { username: string | null; profile_pic_url: string | null }[]
      | null;
    });
  }

  if (data.status === "pending") {
    return null;
  }

  if (data.status === "draft") {
    return null;
  }

  return mapReviewRow(data as {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    content_html?: string | null;
    rating_avg?: number | string | null;
    rating_count?: number | string | null;
    votes_up?: number | string | null;
    votes_down?: number | string | null;
    photo_urls?: unknown;
    photo_count?: number | string | null;
    category_id?: number | string | null;
    sub_category_id?: number | string | null;
    created_at: string;
    profiles?:
    | { username: string | null; profile_pic_url: string | null }
    | { username: string | null; profile_pic_url: string | null }[]
    | null;
  });
}

export async function fetchReviewMetaById(
  env: ParsedEnv,
  id: string
): Promise<{
  slug: string;
  categoryId: number | null;
  status: string;
  authorUsername?: string | null;
} | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("reviews")
    .select("slug, category_id, status, profiles(username)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    slug: data.slug,
    categoryId: data.category_id ?? null,
    status: data.status ?? "published",
    authorUsername: Array.isArray(data.profiles)
      ? data.profiles[0]?.username ?? null
      : data.profiles?.username ?? null,
  };
}

export async function fetchCommentStatusById(
  env: ParsedEnv,
  id: string
): Promise<{
  id: string;
  reviewId: string;
  status: string;
} | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("comments")
    .select("id, review_id, status")
    .eq("id", id)
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
    status: data.status ?? "published",
  };
}

export async function fetchReviewComments(
  env: ParsedEnv,
  reviewId: string,
  cursor: string | null,
  limit: number
): Promise<CursorResult<Comment>> {
  const supabase = getSupabaseClient(env);
  let query = supabase
    .from("comments")
    .select("id, review_id, text, created_at, profiles(username, profile_pic_url)")
    .eq("review_id", reviewId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const items = (data ?? []).map(mapCommentRow);
  const nextCursor = items.length > 0 ? items[items.length - 1].createdAt : null;

  return { items, nextCursor };
}

export async function createReview(
  env: ParsedEnv,
  payload: CreateReviewPayload
): Promise<{ id: string; slug: string }> {
  const supabase = getSupabaseClient(env);
  const baseSlug = slugify(payload.title) || `review-${Date.now()}`;
  const slug = await ensureUniqueSlug(env, baseSlug);

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      slug,
      title: payload.title,
      excerpt: payload.excerpt,
      content_html: payload.contentHtml,
      rating_avg: payload.rating,
      rating_count: 1,
      votes_up: 0,
      votes_down: 0,
      photo_urls: payload.photoUrls,
      photo_count: payload.photoUrls.length,
      category_id: payload.categoryId,
      sub_category_id: payload.subCategoryId ?? null,
      user_id: payload.userId,
      source: "user",
      status: "pending",
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    throw error;
  }

  return data;
}

export async function addComment(
  env: ParsedEnv,
  payload: { reviewId: string; userId: string; text: string }
): Promise<Comment> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("comments")
    .insert({
      review_id: payload.reviewId,
      user_id: payload.userId,
      text: payload.text,
    })
    .select("id, review_id, text, created_at, profiles(username, profile_pic_url)")
    .single();

  if (error || !data) {
    throw error;
  }

  return mapCommentRow(data as {
    id: string;
    review_id: string;
    text: string;
    created_at: string;
    profiles?:
    | { username: string | null; profile_pic_url: string | null }
    | { username: string | null; profile_pic_url: string | null }[]
    | null;
  });
}

export async function addVote(
  env: ParsedEnv,
  payload: {
    reviewId: string;
    userId?: string | null;
    ipHash?: string | null;
    type: "up" | "down";
  }
): Promise<{ votesUp: number; votesDown: number }> {
  const supabase = getSupabaseClient(env);
  const { error: voteError } = await supabase.from("review_votes").insert({
    review_id: payload.reviewId,
    user_id: payload.userId ?? null,
    ip_hash: payload.ipHash ?? null,
    type: payload.type,
  });

  if (voteError) {
    throw voteError;
  }

  const { data: reviewData, error: reviewError } = await supabase
    .from("reviews")
    .select("votes_up, votes_down")
    .eq("id", payload.reviewId)
    .single();

  if (reviewError || !reviewData) {
    throw reviewError;
  }

  const votesUp = (reviewData.votes_up ?? 0) + (payload.type === "up" ? 1 : 0);
  const votesDown =
    (reviewData.votes_down ?? 0) + (payload.type === "down" ? 1 : 0);

  const { error: updateError } = await supabase
    .from("reviews")
    .update({ votes_up: votesUp, votes_down: votesDown })
    .eq("id", payload.reviewId);

  if (updateError) {
    throw updateError;
  }

  return { votesUp, votesDown };
}

export async function incrementReviewViews(
  env: ParsedEnv,
  reviewId: string
): Promise<{ views: number } | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase.rpc("increment_review_view", {
    review_id: reviewId,
  });

  if (error) {
    throw error;
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const rawViews = data[0]?.views ?? 0;
  const views = typeof rawViews === "number" ? rawViews : Number(rawViews);
  return { views: Number.isFinite(views) ? views : 0 };
}

export async function fetchReviewsByUserComments(
  env: ParsedEnv,
  userId: string,
  page: number,
  pageSize: number
): Promise<ReviewListResult> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase.rpc("get_user_commented_reviews", {
    target_user_id: userId,
    page,
    page_size: pageSize,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ReviewWithCountRow[];
  const items = rows.map((row) => mapReviewRow(row as DbReviewRow));
  const totalItems = normalizeTotalCount(rows[0]?.total_count);

  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, totalItems),
  };
}

export async function fetchSavedReviews(
  env: ParsedEnv,
  userId: string,
  page: number,
  pageSize: number
): Promise<ReviewListResult> {
  const supabase = getSupabaseClient(env);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("saved_reviews")
    .select(
      `review_id, reviews(${reviewListSelect})`,
      { count: "exact" }
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const items = (data ?? [])
    .map((row) => (row as { reviews: DbReviewRow | null }).reviews)
    .filter((review): review is DbReviewRow => Boolean(review))
    .map((review) => mapReviewRow(review));

  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function fetchReviewsByUserId(
  env: ParsedEnv,
  userId: string,
  page: number,
  pageSize: number,
  statuses: ReviewStatus[] = ["published"]
): Promise<ReviewListResult> {
  const supabase = getSupabaseClient(env);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("reviews")
    .select(reviewListSelect, { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (statuses.length > 0) {
    query = query.in("status", statuses);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: (data ?? []).map(mapReviewRow),
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

function buildHiddenReview(row: {
  id: string;
  slug: string;
  created_at: string;
  profiles?:
  | { username: string | null; profile_pic_url: string | null }
  | { username: string | null; profile_pic_url: string | null }[]
  | null;
}): Review {
  const profile = Array.isArray(row.profiles)
    ? row.profiles[0] ?? null
    : row.profiles ?? null;
  return {
    id: row.id,
    slug: row.slug,
    title: HIDDEN_REVIEW_TITLE,
    excerpt: HIDDEN_REVIEW_EXCERPT,
    contentHtml: `<p>${HIDDEN_REVIEW_EXCERPT}</p>`,
    ratingAvg: undefined,
    ratingCount: undefined,
    views: undefined,
    votesUp: undefined,
    votesDown: undefined,
    photoUrls: [],
    photoCount: 0,
    commentCount: undefined,
    author: {
      username: profile?.username ?? "unknown",
      displayName: profile?.username ?? undefined,
      profilePicUrl: profile?.profile_pic_url ?? undefined,
    },
    createdAt: row.created_at,
  };
}

function normalizeTotalCount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function ensureUniqueSlug(
  env: ParsedEnv,
  baseSlug: string
): Promise<string> {
  const supabase = getSupabaseClient(env);
  let candidate = baseSlug;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition -- intentional loop until slug is unique
  while (true) {
    const { data, error } = await supabase
      .from("reviews")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}
