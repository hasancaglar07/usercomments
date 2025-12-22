import { supabase } from "../db/supabase";
import { buildPaginationInfo } from "../utils/pagination";
import type { PaginationInfo } from "../types/api";

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
  page: number,
  pageSize: number
): Promise<SitemapResult<SitemapReviewItem>> {
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

export async function fetchSitemapCategories(): Promise<
  SitemapResult<SitemapCategoryItem>
> {
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
