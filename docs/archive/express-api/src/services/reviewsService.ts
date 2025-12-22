import { supabase } from "../db/supabase";
import type { Comment, PaginationInfo, Review } from "../types/api";
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

const HIDDEN_REVIEW_TITLE = "Review not available";
const HIDDEN_REVIEW_EXCERPT = "This review is currently unavailable.";

const reviewListSelect = `
  id,
  slug,
  title,
  excerpt,
  rating_avg,
  rating_count,
  votes_up,
  votes_down,
  photo_urls,
  photo_count,
  category_id,
  sub_category_id,
  created_at,
  profiles(username)
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

export async function fetchPopularReviews(limit: number): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select(reviewListSelect)
    .eq("status", "published")
    .order("votes_up", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapReviewRow);
}

export async function fetchLatestReviews(
  cursor: string | null,
  limit: number
): Promise<CursorResult<Review>> {
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

export async function fetchReviews(options: {
  categoryId?: number;
  subCategoryId?: number;
  sort: ReviewSort;
  page: number;
  pageSize: number;
}): Promise<ReviewListResult> {
  const { categoryId, subCategoryId, sort, page, pageSize } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("reviews")
    .select(reviewListSelect, { count: "exact" });

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

export async function fetchReviewBySlug(slug: string): Promise<Review | null> {
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
    return buildHiddenReview(data);
  }

  return mapReviewRow(data);
}

export async function fetchReviewMetaById(id: string): Promise<{
  slug: string;
  categoryId: number | null;
  status: string;
} | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select("slug, category_id, status")
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
  };
}

export async function fetchCommentStatusById(id: string): Promise<{
  id: string;
  reviewId: string;
  status: string;
} | null> {
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
  reviewId: string,
  cursor: string | null,
  limit: number
): Promise<CursorResult<Comment>> {
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
  payload: CreateReviewPayload
): Promise<{ id: string; slug: string }> {
  const baseSlug = slugify(payload.title) || `review-${Date.now()}`;
  const slug = await ensureUniqueSlug(baseSlug);

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
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    throw error;
  }

  return data;
}

export async function addComment(payload: {
  reviewId: string;
  userId: string;
  text: string;
}): Promise<Comment> {
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

  return mapCommentRow(data);
}

export async function addVote(payload: {
  reviewId: string;
  userId?: string | null;
  ipHash?: string | null;
  type: "up" | "down";
}): Promise<{ votesUp: number; votesDown: number }> {
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

  const votesUp =
    (reviewData.votes_up ?? 0) + (payload.type === "up" ? 1 : 0);
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

export async function fetchReviewsByUserId(
  userId: string,
  page: number,
  pageSize: number
): Promise<ReviewListResult> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("reviews")
    .select(reviewListSelect, { count: "exact" })
    .eq("user_id", userId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(from, to);

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
  profiles?: { username: string | null } | { username: string | null }[] | null;
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
    votesUp: undefined,
    votesDown: undefined,
    photoUrls: [],
    photoCount: 0,
    author: {
      username: profile?.username ?? "unknown",
      displayName: profile?.username ?? undefined,
    },
    createdAt: row.created_at,
  };
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
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
