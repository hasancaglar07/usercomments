import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import { buildPaginationInfo } from "../utils/pagination";
import type { PaginationInfo } from "../types";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../utils/i18n";

export type SitemapReviewItem = {
  slug: string;
  createdAt: string;
  updatedAt: string | null;
  imageUrls?: string[];
};

export type SitemapCategoryItem = {
  id: number;
  name: string;
};

export type SitemapProductItem = {
  slug: string;
  createdAt: string;
  updatedAt: string | null;
  imageUrls?: string[];
};

export type SitemapResult<T> = {
  items: T[];
  pageInfo: PaginationInfo;
};

const MAX_SITEMAP_IMAGES = 5;

function normalizeStringArray(value: unknown): string[] {
  if (!value) {
    return [];
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
      return [];
    }
  }
  return [];
}

function pickImageUrls(urls: string[] | undefined): string[] | undefined {
  if (!urls || urls.length === 0) {
    return undefined;
  }
  const filtered = urls
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    // Transform R2 URLs to CDN URLs
    .map((url) => {
      // Replace R2 public bucket URLs with main site domain
      if (url.includes("r2.dev") || url.includes("r2.cloudflarestorage.com")) {
        // Extract path after the bucket portion and use main domain
        const match = url.match(/r2\.(dev|cloudflarestorage\.com)\/(public\/.*)/);
        if (match && match[2]) {
          return `https://userreview.net/cdn-images/${match[2]}`;
        }
        // Alternative pattern: just the path after domain
        const pathMatch = url.match(/r2\.(dev|cloudflarestorage\.com)\/(.+)/);
        if (pathMatch && pathMatch[2]) {
          return `https://userreview.net/cdn-images/${pathMatch[2]}`;
        }
      }
      return url;
    });
  if (filtered.length === 0) {
    return undefined;
  }
  const deduped = Array.from(new Set(filtered));
  const limited = deduped.slice(0, MAX_SITEMAP_IMAGES);
  return limited.length > 0 ? limited : undefined;
}

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
    .select("created_at, updated_at, photo_urls, review_translations!inner(lang, slug)", {
      count: "estimated",
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
      const imageUrls = pickImageUrls(normalizeStringArray(row.photo_urls));
      return {
        slug: translation.slug,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? null,
        imageUrls,
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
    .select("id, review_translations!inner(lang)", { count: "estimated", head: true })
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
    .select(
      "created_at, updated_at, product_translations!inner(lang, slug), product_images(url, sort_order)",
      {
        count: "estimated",
      }
    )
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
      const productImages = Array.isArray(row.product_images)
        ? row.product_images
        : [];
      const sortedImages = [...productImages].sort((left, right) => {
        const leftOrder = Number(left?.sort_order ?? 0);
        const rightOrder = Number(right?.sort_order ?? 0);
        const normalizedLeft = Number.isFinite(leftOrder) ? leftOrder : 0;
        const normalizedRight = Number.isFinite(rightOrder) ? rightOrder : 0;
        return normalizedLeft - normalizedRight;
      });
      const imageUrls = pickImageUrls(
        sortedImages
          .map((image) => image?.url)
          .filter((url): url is string => typeof url === "string")
      );
      return {
        slug: translation.slug,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? null,
        imageUrls,
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
    .select("id, product_translations!inner(lang)", { count: "estimated", head: true })
    .eq("product_translations.lang", lang)
    .eq("status", "published");

  if (error) {
    throw error;
  }

  return count ?? 0;
}
