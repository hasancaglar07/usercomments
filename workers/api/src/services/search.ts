import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import type { PaginationInfo, Review } from "../types";
import type { SupportedLanguage } from "../utils/i18n";
import { buildPaginationInfo } from "../utils/pagination";
import { mapReviewRow } from "./mappers";

type SearchResult = {
  items: Review[];
  pageInfo: PaginationInfo;
};

type SearchRow = {
  review_id: string;
  lang: string;
  slug: string;
  title?: string | null;
  excerpt?: string | null;
  content_html?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  reviews?: {
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
    profiles?: { username: string | null; profile_pic_url: string | null } | { username: string | null; profile_pic_url: string | null }[] | null;
    status?: string | null;
  } | {
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
    profiles?: { username: string | null; profile_pic_url: string | null } | { username: string | null; profile_pic_url: string | null }[] | null;
    status?: string | null;
  }[] | null;
};

export async function searchReviews(env: ParsedEnv, options: {
  q: string;
  categoryId?: number;
  page: number;
  pageSize: number;
  lang: SupportedLanguage;
}): Promise<SearchResult> {
  const supabase = getSupabaseClient(env);
  const { q, categoryId, page, pageSize, lang } = options;
  const normalizedQuery = q.trim().replace(/,/g, " ");

  if (!normalizedQuery) {
    return {
      items: [],
      pageInfo: buildPaginationInfo(page, pageSize, 0),
    };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const escapedQuery = normalizedQuery.replace(/[%_]/g, "\\$&");
  const pattern = `%${escapedQuery}%`;
  let query = supabase
    .from("review_translations")
    .select(
      `
        review_id,
        lang,
        slug,
        title,
        excerpt,
        content_html,
        meta_title,
        meta_description,
        reviews(
          id,
          slug,
          title,
          excerpt,
          content_html,
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
          status,
          profiles(username, profile_pic_url)
        )
      `,
      { count: "exact" }
    )
    .eq("lang", lang)
    .eq("reviews.status", "published")
    .or(`title.ilike.${pattern},content_html.ilike.${pattern}`);

  if (categoryId) {
    query = query.eq("reviews.category_id", categoryId);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SearchRow[];
  const items = rows
    .map((row) => {
      if (!row.reviews) {
        return null;
      }
      const merged = {
        ...row.reviews,
        review_translations: [
          {
            lang: row.lang,
            slug: row.slug,
            title: row.title ?? "",
            excerpt: row.excerpt ?? null,
            content_html: row.content_html ?? null,
            meta_title: row.meta_title ?? null,
            meta_description: row.meta_description ?? null,
          },
        ],
      };
      return mapReviewRow(merged as any, { lang, r2BaseUrl: env.R2_PUBLIC_BASE_URL });
    })
    .filter((item): item is Review => Boolean(item));

  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}
