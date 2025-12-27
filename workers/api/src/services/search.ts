import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import type { PaginationInfo, Review, SearchSuggestion } from "../types";
import type { SupportedLanguage } from "../utils/i18n";
import { buildPaginationInfo } from "../utils/pagination";
import { mapReviewRow } from "./mappers";

type SearchResult = {
  items: Review[];
  pageInfo: PaginationInfo;
};

type ReviewSearchRow = {
  review_id: string;
  review_slug?: string | null;
  review_title?: string | null;
  review_excerpt?: string | null;
  review_content_html?: string | null;
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
  review_category_id?: number | string | null;
  review_sub_category_id?: number | string | null;
  product_id?: string | null;
  created_at: string;
  profile_username?: string | null;
  profile_pic_url?: string | null;
  product_slug?: string | null;
  product_name?: string | null;
  translation_lang?: string | null;
  translation_slug?: string | null;
  translation_title?: string | null;
  translation_excerpt?: string | null;
  translation_content_html?: string | null;
  translation_meta_title?: string | null;
  translation_meta_description?: string | null;
  total_count?: number | string | null;
  score?: number | string | null;
};

type ReviewSearchOptions = {
  q: string;
  categoryId?: number;
  page: number;
  pageSize: number;
  lang: SupportedLanguage;
};

type ReviewSuggestionOptions = {
  q: string;
  limit: number;
  lang: SupportedLanguage;
};

type DbReviewRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html?: string | null;
  review_translations?: {
    lang: string;
    slug: string;
    title?: string | null;
    excerpt?: string | null;
    content_html?: string | null;
    meta_title?: string | null;
    meta_description?: string | null;
  }[] | null;
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

type ScoredSuggestion = SearchSuggestion & { score: number };

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

function normalizeScore(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildReviewRow(row: ReviewSearchRow): DbReviewRow | null {
  if (!row.review_id) {
    return null;
  }

  const translationLang = row.translation_lang ?? "";
  const translationSlug = row.translation_slug ?? row.review_slug ?? "";
  const translationTitle = row.translation_title ?? row.review_title ?? "";

  return {
    id: row.review_id,
    slug: row.review_slug ?? translationSlug,
    title: row.review_title ?? translationTitle,
    excerpt: row.review_excerpt ?? null,
    content_html: row.review_content_html ?? null,
    rating_avg: row.rating_avg,
    rating_count: row.rating_count,
    views: row.views,
    votes_up: row.votes_up,
    votes_down: row.votes_down,
    photo_urls: row.photo_urls,
    photo_count: row.photo_count,
    comment_count: row.comment_count,
    recommend: row.recommend ?? null,
    pros: row.pros,
    cons: row.cons,
    category_id: row.review_category_id ?? null,
    sub_category_id: row.review_sub_category_id ?? null,
    product_id: row.product_id ?? null,
    created_at: row.created_at,
    profiles: row.profile_username
      ? {
          username: row.profile_username,
          profile_pic_url: row.profile_pic_url ?? null,
        }
      : null,
    products: row.product_id
      ? {
          id: row.product_id,
          slug: row.product_slug ?? null,
          name: row.product_name ?? null,
        }
      : null,
    review_translations: translationLang
      ? [
          {
            lang: translationLang,
            slug: translationSlug,
            title: translationTitle,
            excerpt: row.translation_excerpt ?? null,
            content_html: row.translation_content_html ?? null,
            meta_title: row.translation_meta_title ?? null,
            meta_description: row.translation_meta_description ?? null,
          },
        ]
      : null,
  };
}

async function fetchReviewSearchRows(
  env: ParsedEnv,
  options: ReviewSearchOptions
): Promise<ReviewSearchRow[]> {
  const supabase = getSupabaseClient(env);
  const { q, categoryId, page, pageSize, lang } = options;
  const normalizedQuery = q.trim().replace(/,/g, " ");

  if (!normalizedQuery) {
    return [];
  }

  const { data, error } = await supabase.rpc("search_reviews_i18n", {
    query: normalizedQuery,
    target_lang: lang,
    category_id: categoryId ?? null,
    page,
    page_size: pageSize,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as ReviewSearchRow[];
}

export async function searchReviews(
  env: ParsedEnv,
  options: ReviewSearchOptions
): Promise<SearchResult> {
  const rows = await fetchReviewSearchRows(env, options);
  const items = rows
    .map((row) => buildReviewRow(row))
    .filter((row): row is DbReviewRow => Boolean(row))
    .map((row) =>
      mapReviewRow(row as any, {
        lang: options.lang,
        r2BaseUrl: env.R2_PUBLIC_BASE_URL,
      })
    );

  const totalItems = normalizeTotalCount(rows[0]?.total_count);

  return {
    items,
    pageInfo: buildPaginationInfo(options.page, options.pageSize, totalItems),
  };
}

export async function searchReviewSuggestions(
  env: ParsedEnv,
  options: ReviewSuggestionOptions
): Promise<ScoredSuggestion[]> {
  const rows = await fetchReviewSearchRows(env, {
    q: options.q,
    lang: options.lang,
    page: 1,
    pageSize: options.limit,
  });

  return rows
    .map((row) => {
      const merged = buildReviewRow(row);
      if (!merged) {
        return null;
      }
      const review = mapReviewRow(merged as any, {
        lang: options.lang,
        r2BaseUrl: env.R2_PUBLIC_BASE_URL,
      });
      const imageUrl = review.photoUrls?.[0];

      return {
        id: review.id,
        type: "review",
        slug: review.slug,
        title: review.title,
        imageUrl,
        ratingAvg: review.ratingAvg,
        ratingCount: review.ratingCount,
        score: normalizeScore(row.score),
      };
    })
    .filter((item): item is ScoredSuggestion => Boolean(item));
}
