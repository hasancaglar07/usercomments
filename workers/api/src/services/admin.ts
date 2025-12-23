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
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../utils/i18n";
import { buildPaginationInfo } from "../utils/pagination";
import { slugify } from "../utils/slug";

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
  review_translations?:
    | {
        lang: string;
        slug: string;
        title?: string | null;
        excerpt?: string | null;
        content_html?: string | null;
      }[]
    | null;
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
  recommend?: boolean | null;
  pros?: unknown;
  cons?: unknown;
  category_id?: number | string | null;
  sub_category_id?: number | string | null;
  product_id?: string | null;
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
  products?:
    | {
        id: string | null;
        slug: string | null;
        name: string | null;
      }
    | {
        id: string | null;
        slug: string | null;
        name: string | null;
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
  recommend,
  pros,
  cons,
  category_id,
  sub_category_id,
  product_id,
  review_translations(lang, slug, title, excerpt, content_html),
  profiles(username, profile_pic_url),
  products(id, slug, name)
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

function pickAdminTranslation(
  translations: DbAdminReview["review_translations"],
  lang: SupportedLanguage
) {
  if (!Array.isArray(translations)) {
    return null;
  }
  return (
    translations.find((translation) => translation.lang === lang) ??
    translations.find((translation) => translation.lang === DEFAULT_LANGUAGE) ??
    null
  );
}

function mapAdminReviewRow(row: DbAdminReview, lang: SupportedLanguage): AdminReview {
  const profile = pickRelation(row.profiles);
  const product = pickRelation(row.products);
  const translation = pickAdminTranslation(row.review_translations, lang);
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
  const pros = normalizeStringArray(row.pros);
  const cons = normalizeStringArray(row.cons);

  return {
    id: row.id,
    slug: translation?.slug ?? row.slug,
    title: translation?.title ?? row.title,
    excerpt: translation?.excerpt ?? row.excerpt ?? "",
    contentHtml: translation?.content_html ?? row.content_html ?? undefined,
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
    recommend: row.recommend ?? undefined,
    pros,
    cons,
    categoryId: categoryId ?? undefined,
    subCategoryId: subCategoryId ?? undefined,
    productId: row.product_id ?? undefined,
    product: product?.id
      ? {
          id: product.id,
          slug: product.slug ?? "",
          name: product.name ?? "",
        }
      : undefined,
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

async function ensureUniqueSlug(
  env: ParsedEnv,
  baseSlug: string
): Promise<string> {
  const supabase = getSupabaseClient(env);
  let candidate = baseSlug;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition -- intentional loop until slug is unique
  while (true) {
    const { data: translation, error: translationError } = await supabase
      .from("review_translations")
      .select("review_id")
      .eq("slug", candidate)
      .maybeSingle();

    if (translationError) {
      throw translationError;
    }

    if (!translation) {
      const { data: review, error: reviewError } = await supabase
        .from("reviews")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();

      if (reviewError) {
        throw reviewError;
      }

      if (!review) {
        return candidate;
      }
    }

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}

export async function fetchAdminReviews(
  env: ParsedEnv,
  options: {
    status?: ReviewStatus;
    page: number;
    pageSize: number;
    lang: SupportedLanguage;
  }
): Promise<ReviewListResult> {
  const supabase = getSupabaseClient(env);
  const { status, page, pageSize, lang } = options;
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
    items: (data ?? []).map((row) => mapAdminReviewRow(row as DbAdminReview, lang)),
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function fetchAdminReviewDetail(
  env: ParsedEnv,
  id: string,
  lang: SupportedLanguage
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

  return mapAdminReviewRow(data as DbAdminReview, lang);
}

export async function updateAdminReview(
  env: ParsedEnv,
  id: string,
  payload: {
    title?: string;
    excerpt?: string;
    contentHtml?: string;
    photoUrls?: string[];
    recommend?: boolean;
    pros?: string[];
    cons?: string[];
    categoryId?: number | null;
    subCategoryId?: number | null;
    productId?: string | null;
  },
  lang: SupportedLanguage
): Promise<AdminReview | null> {
  const supabase = getSupabaseClient(env);
  const updates: Record<string, unknown> = {};
  const translationUpdates: Record<string, unknown> = {};
  const shouldUpdateBase = lang === DEFAULT_LANGUAGE;

  if (payload.title !== undefined) {
    if (shouldUpdateBase) {
      updates.title = payload.title;
    }
    translationUpdates.title = payload.title;
  }
  if (payload.excerpt !== undefined) {
    if (shouldUpdateBase) {
      updates.excerpt = payload.excerpt;
    }
    translationUpdates.excerpt = payload.excerpt;
  }
  if (payload.contentHtml !== undefined) {
    if (shouldUpdateBase) {
      updates.content_html = payload.contentHtml;
    }
    translationUpdates.content_html = payload.contentHtml;
  }
  if (payload.photoUrls !== undefined) {
    updates.photo_urls = payload.photoUrls;
    updates.photo_count = payload.photoUrls.length;
  }
  if (payload.recommend !== undefined) {
    updates.recommend = payload.recommend;
  }
  if (payload.pros !== undefined) {
    updates.pros = payload.pros;
  }
  if (payload.cons !== undefined) {
    updates.cons = payload.cons;
  }
  if (payload.categoryId !== undefined) {
    updates.category_id = payload.categoryId;
  }
  if (payload.subCategoryId !== undefined) {
    updates.sub_category_id = payload.subCategoryId;
  }
  if (payload.productId !== undefined) {
    updates.product_id = payload.productId;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("reviews").update(updates).eq("id", id);
    if (error) {
      throw error;
    }
  }

  if (
    payload.categoryId !== undefined ||
    payload.subCategoryId !== undefined ||
    payload.productId !== undefined
  ) {
    const { data: reviewRow, error: reviewError } = await supabase
      .from("reviews")
      .select("product_id, category_id, sub_category_id")
      .eq("id", id)
      .maybeSingle();

    if (reviewError) {
      throw reviewError;
    }

    if (reviewRow?.product_id) {
      const categoryIds = [reviewRow.category_id, reviewRow.sub_category_id]
        .map((value) => (value !== null && value !== undefined ? Number(value) : null))
        .filter((value): value is number => Number.isFinite(value));
      if (categoryIds.length > 0) {
        const { error: categoryError } = await supabase
          .from("product_categories")
          .upsert(
            categoryIds.map((categoryId) => ({
              product_id: reviewRow.product_id,
              category_id: categoryId,
            })),
            { onConflict: "product_id,category_id" }
          );
        if (categoryError) {
          throw categoryError;
        }
      }
    }
  }

  if (Object.keys(translationUpdates).length > 0) {
    const { data: existingTranslation, error: existingError } = await supabase
      .from("review_translations")
      .select("slug")
      .eq("review_id", id)
      .eq("lang", lang)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingTranslation) {
      const { error: updateError } = await supabase
        .from("review_translations")
        .update(translationUpdates)
        .eq("review_id", id)
        .eq("lang", lang);

      if (updateError) {
        throw updateError;
      }
    } else if (translationUpdates.title !== undefined) {
      const baseSlug =
        slugify(translationUpdates.title as string) || `review-${Date.now()}`;
      const slug = await ensureUniqueSlug(env, baseSlug);
      const { error: insertError } = await supabase
        .from("review_translations")
        .insert({
          review_id: id,
          lang,
          slug,
          ...translationUpdates,
        });

      if (insertError) {
        throw insertError;
      }
    }
  }

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

  return mapAdminReviewRow(data as DbAdminReview, lang);
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
