import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import type { PaginationInfo, Review } from "../types";
import { buildPaginationInfo } from "../utils/pagination";
import { mapReviewRow } from "./mappers";

type SearchResult = {
  items: Review[];
  pageInfo: PaginationInfo;
};

type SearchRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
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
  profiles?: { username: string | null; profile_pic_url?: string | null } | null;
  total_count?: number | string | null;
};

export async function searchReviews(env: ParsedEnv, options: {
  q: string;
  categoryId?: number;
  page: number;
  pageSize: number;
}): Promise<SearchResult> {
  const supabase = getSupabaseClient(env);
  const { q, categoryId, page, pageSize } = options;
  const normalizedQuery = q.trim().replace(/,/g, " ");

  if (!normalizedQuery) {
    return {
      items: [],
      pageInfo: buildPaginationInfo(page, pageSize, 0),
    };
  }

  const { data, error } = await supabase.rpc("search_reviews", {
    query: normalizedQuery,
    category_id: categoryId ?? null,
    page,
    page_size: pageSize,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SearchRow[];
  const items = rows.map(mapReviewRow);
  const totalRaw = rows[0]?.total_count ?? 0;
  const totalItems = typeof totalRaw === "number" ? totalRaw : Number(totalRaw ?? 0);

  return {
    items,
    pageInfo: buildPaginationInfo(
      page,
      pageSize,
      Number.isFinite(totalItems) ? totalItems : 0
    ),
  };
}
