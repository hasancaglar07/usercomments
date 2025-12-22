import type { Category, Comment, Review, UserProfile } from "../types";

type DbProfile = {
  user_id: string;
  username: string;
  bio: string | null;
  profile_pic_url: string | null;
};

type DbCategory = {
  id: number;
  name: string;
  parent_id: number | null;
};

type DbReview = {
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
    | {
        username: string | null;
      }
    | {
        username: string | null;
      }[]
    | null;
};

type DbComment = {
  id: string;
  review_id: string;
  text: string;
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

export function mapCategoryRow(row: DbCategory): Category {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
  };
}

export function mapProfileRow(row: DbProfile): UserProfile {
  return {
    username: row.username,
    displayName: row.username,
    bio: row.bio ?? undefined,
    profilePicUrl: row.profile_pic_url ?? undefined,
  };
}

export function mapReviewRow(row: DbReview): Review {
  const profile = pickRelation(row.profiles);
  const photoUrls = Array.isArray(row.photo_urls)
    ? row.photo_urls.filter((item): item is string => typeof item === "string")
    : undefined;

  const ratingAvg = normalizeNumber(row.rating_avg);
  const ratingCount = normalizeNumber(row.rating_count);
  const votesUp = normalizeNumber(row.votes_up);
  const votesDown = normalizeNumber(row.votes_down);
  const photoCount = normalizeNumber(row.photo_count);
  const categoryId = normalizeNumber(row.category_id);
  const subCategoryId = normalizeNumber(row.sub_category_id);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    contentHtml: row.content_html ?? undefined,
    ratingAvg,
    ratingCount,
    votesUp,
    votesDown,
    photoCount: photoCount ?? photoUrls?.length,
    photoUrls,
    author: {
      username: profile?.username ?? "unknown",
      displayName: profile?.username ?? undefined,
    },
    createdAt: row.created_at,
    categoryId: categoryId ?? undefined,
    subCategoryId: subCategoryId ?? undefined,
  };
}

export function mapCommentRow(row: DbComment): Comment {
  const profile = pickRelation(row.profiles);
  return {
    id: row.id,
    reviewId: row.review_id,
    text: row.text,
    createdAt: row.created_at,
    author: {
      username: profile?.username ?? "unknown",
      displayName: profile?.username ?? undefined,
      profilePicUrl: profile?.profile_pic_url ?? undefined,
    },
  };
}

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

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}
