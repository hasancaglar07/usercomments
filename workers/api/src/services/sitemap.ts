import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import { buildPaginationInfo } from "../utils/pagination";
import type { PaginationInfo } from "../types";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../utils/i18n";

export type SitemapReviewItem = {
  slug: string;
  createdAt: string;
  updatedAt: string | null;
};

export type SitemapCategoryItem = {
  id: number;
  name: string;
};

export type SitemapProductItem = {
  slug: string;
  createdAt: string;
  updatedAt: string | null;
};

export type SitemapResult<T> = {
  items: T[];
  pageInfo: PaginationInfo;
};

export async function fetchSitemapReviews(
  env: ParsedEnv,
  page: number,
  pageSize: number,
  lang: SupportedLanguage
): Promise<SitemapResult<SitemapReviewItem>> {
  const supabase = getSupabaseClient(env);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("reviews")
    .select("created_at, updated_at, review_translations!inner(lang, slug)", {
      count: "exact",
    })
    .eq("review_translations.lang", lang)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const items = (data ?? [])
    .map((row) => {
      const translations = Array.isArray(row.review_translations)
        ? row.review_translations
        : [];
      const translation = translations[0];
      if (!translation?.slug) {
        return null;
      }
      return {
        slug: translation.slug,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? null,
      };
    })
    .filter((item): item is SitemapReviewItem => Boolean(item));

  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function fetchSitemapReviewCount(
  env: ParsedEnv,
  lang: SupportedLanguage
): Promise<number> {
  const supabase = getSupabaseClient(env);
  const { count, error } = await supabase
    .from("reviews")
    .select("id, review_translations!inner(lang)", { count: "exact", head: true })
    .eq("review_translations.lang", lang)
    .eq("status", "published");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function fetchSitemapCategories(
  env: ParsedEnv,
  lang: SupportedLanguage
): Promise<SitemapResult<SitemapCategoryItem>> {
  const supabase = getSupabaseClient(env);
  if (lang === DEFAULT_LANGUAGE) {
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

  const { data, error } = await supabase
    .from("category_translations")
    .select("category_id, name")
    .eq("lang", lang)
    .order("category_id");

  if (error) {
    throw error;
  }

  const items = (data ?? []).map((row) => ({
    id: row.category_id,
    name: row.name,
  }));

  return {
    items,
    pageInfo: buildPaginationInfo(1, items.length, items.length),
  };
}

export async function fetchSitemapProducts(
  env: ParsedEnv,
  page: number,
  pageSize: number,
  lang: SupportedLanguage
): Promise<SitemapResult<SitemapProductItem>> {
  const supabase = getSupabaseClient(env);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("products")
    .select("created_at, updated_at, product_translations!inner(lang, slug)", {
      count: "exact",
    })
    .eq("product_translations.lang", lang)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const items = (data ?? [])
    .map((row) => {
      const translations = Array.isArray(row.product_translations)
        ? row.product_translations
        : [];
      const translation = translations[0];
      if (!translation?.slug) {
        return null;
      }
      return {
        slug: translation.slug,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? null,
      };
    })
    .filter((item): item is SitemapProductItem => Boolean(item));

  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function fetchSitemapProductCount(
  env: ParsedEnv,
  lang: SupportedLanguage
): Promise<number> {
  const supabase = getSupabaseClient(env);
  const { count, error } = await supabase
    .from("products")
    .select("id, product_translations!inner(lang)", { count: "exact", head: true })
    .eq("product_translations.lang", lang)
    .eq("status", "published");

  if (error) {
    throw error;
  }

  return count ?? 0;
}
