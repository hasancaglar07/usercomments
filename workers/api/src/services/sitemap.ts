import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import { buildPaginationInfo } from "../utils/pagination";
import type { PaginationInfo } from "../types";

export type SitemapReviewItem = {
  slug: string;
  createdAt: string;
  updatedAt: string | null;
};

export type SitemapCategoryItem = {
  id: number;
  name: string;
};

export type SitemapResult<T> = {
  items: T[];
  pageInfo: PaginationInfo;
};

export async function fetchSitemapReviews(
  env: ParsedEnv,
  page: number,
  pageSize: number
): Promise<SitemapResult<SitemapReviewItem>> {
  const supabase = getSupabaseClient(env);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("reviews")
    .select("slug, created_at, updated_at", { count: "exact" })
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const items = (data ?? []).map((row) => ({
    slug: row.slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  }));

  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function fetchSitemapReviewCount(env: ParsedEnv): Promise<number> {
  const supabase = getSupabaseClient(env);
  const { count, error } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function fetchSitemapCategories(
  env: ParsedEnv
): Promise<SitemapResult<SitemapCategoryItem>> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("id");

  if (error) {
    throw error;
  }

  const items = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
  }));

  return {
    items,
    pageInfo: buildPaginationInfo(1, items.length, items.length),
  };
}
