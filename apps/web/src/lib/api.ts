import type {
  Category,
  Comment,
  PaginationInfo,
  Product,
  Review,
  UserProfile,
} from "@/src/types";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "@/src/lib/i18n";

export type CursorResult<T> = {
  items: T[];
  nextCursor: string | null;
};

export type PaginatedResult<T> = {
  items: T[];
  pageInfo: PaginationInfo;
};

type FetchOptions = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://irecommend-api.usercomments.workers.dev";
const BASE_URL = RAW_BASE_URL?.replace(/\/$/, "");

function getBaseUrl(): string {
  if (!BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return BASE_URL;
}

async function fetchJson<T>(path: string, init?: FetchOptions): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const method = init?.method ?? "GET";
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      cache: init?.cache ?? "no-store",
      headers: {
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Network error.";
    throw new Error(`API request failed (${method} ${url}): ${message}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const responseText = await response.text();
  const maxBody = 500;
  const bodySnippet =
    responseText.length > maxBody
      ? `${responseText.slice(0, maxBody)}...`
      : responseText;

  if (!response.ok) {
    let detail = bodySnippet;
    if (contentType.includes("application/json") && responseText) {
      try {
        const data = JSON.parse(responseText) as { error?: string };
        if (data?.error) {
          detail = data.error;
        }
      } catch {
        // ignore JSON parse errors for error payloads
      }
    }
    throw new Error(
      `API request failed (${response.status} ${response.statusText}) (${method} ${url}): ${detail || "No response body"}`
    );
  }

  if (!responseText) {
    throw new Error(`API response was empty (${method} ${url}).`);
  }

  try {
    return JSON.parse(responseText) as T;
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Invalid JSON response.";
    throw new Error(`API response parse failed (${method} ${url}): ${message}`);
  }
}

export async function getPopularReviews(
  limit = 3,
  lang: SupportedLanguage = DEFAULT_LANGUAGE,
  fetchOptions?: FetchOptions
): Promise<Review[]> {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    lang,
  });
  const options: FetchOptions = {
    cache: "force-cache",
    next: { revalidate: 60 },
    ...fetchOptions,
  };
  return fetchJson<PaginatedResult<Review>>(
    `/api/reviews/popular?${searchParams}`,
    options
  ).then((result) => result.items);
}

export async function getLatestReviews(
  limit = 3,
  cursor?: string | null,
  lang: SupportedLanguage = DEFAULT_LANGUAGE,
  fetchOptions?: FetchOptions
): Promise<CursorResult<Review>> {
  const searchParams = new URLSearchParams({ limit: String(limit), lang });
  if (cursor) {
    searchParams.set("cursor", cursor);
  }
  const options: FetchOptions = {
    cache: "force-cache",
    next: { revalidate: 60 },
    ...fetchOptions,
  };
  return fetchJson<CursorResult<Review>>(
    `/api/reviews/latest?${searchParams}`,
    options
  );
}

export async function getCatalogPage(
  page: number,
  pageSize: number,
  sort: "latest" | "popular" | "rating" = "latest",
  categoryId?: number,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<PaginatedResult<Review>> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    lang,
  });
  if (categoryId) {
    searchParams.set("categoryId", String(categoryId));
  }
  return fetchJson<PaginatedResult<Review>>(`/api/reviews?${searchParams}`, {
    cache: "force-cache",
    next: { revalidate: 60 },
  });
}

export async function getCategoryPage(
  id: number,
  page: number,
  pageSize: number,
  sort: "latest" | "popular" | "rating" = "latest",
  subCategoryId?: number,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<PaginatedResult<Review>> {
  const searchParams = new URLSearchParams({
    categoryId: String(id),
    page: String(page),
    pageSize: String(pageSize),
    sort,
    lang,
  });
  if (subCategoryId) {
    searchParams.set("subCategoryId", String(subCategoryId));
  }
  return fetchJson<PaginatedResult<Review>>(`/api/reviews?${searchParams}`, {
    cache: "force-cache",
    next: { revalidate: 60 },
  });
}

export async function getUserProfile(username: string): Promise<UserProfile> {
  return fetchJson<UserProfile>(`/api/users/${encodeURIComponent(username)}`, {
    cache: "force-cache",
    next: { revalidate: 60 },
  });
}

export async function getUserReviews(
  username: string,
  page: number,
  pageSize: number,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<PaginatedResult<Review>> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    lang,
  });
  return fetchJson<PaginatedResult<Review>>(
    `/api/users/${encodeURIComponent(username)}/reviews?${searchParams}`,
    {
      cache: "force-cache",
      next: { revalidate: 60 },
    }
  );
}

export async function getUserComments(
  username: string,
  page: number,
  pageSize: number,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<PaginatedResult<Review>> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    lang,
  });
  return fetchJson<PaginatedResult<Review>>(
    `/api/users/${encodeURIComponent(username)}/comments?${searchParams}`,
    {
      cache: "force-cache",
      next: { revalidate: 60 },
    }
  );
}

export async function getReviewBySlug(
  slug: string,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Review> {
  const searchParams = new URLSearchParams({ lang });
  return fetchJson<Review>(
    `/api/reviews/slug/${encodeURIComponent(slug)}?${searchParams}`
  );
}

export async function getProducts(
  page: number,
  pageSize: number,
  sort: "latest" | "popular" | "rating" = "latest",
  categoryId?: number,
  lang: SupportedLanguage = DEFAULT_LANGUAGE,
  fetchOptions?: FetchOptions
): Promise<PaginatedResult<Product>> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    lang,
  });
  if (categoryId) {
    searchParams.set("categoryId", String(categoryId));
  }
  const options: FetchOptions = {
    cache: "force-cache",
    next: { revalidate: 300 },
    ...fetchOptions,
  };
  return fetchJson<PaginatedResult<Product>>(`/api/products?${searchParams}`, options);
}

export async function getProductBySlug(
  slug: string,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Product> {
  const searchParams = new URLSearchParams({ lang });
  return fetchJson<Product>(
    `/api/products/slug/${encodeURIComponent(slug)}?${searchParams}`,
    {
      cache: "force-cache",
      next: { revalidate: 300 },
    }
  );
}

export async function getProductReviews(
  productId: string,
  page: number,
  pageSize: number,
  sort: "latest" | "popular" | "rating" = "latest",
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<PaginatedResult<Review>> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    lang,
  });
  return fetchJson<PaginatedResult<Review>>(
    `/api/products/${encodeURIComponent(productId)}/reviews?${searchParams}`,
    {
      cache: "force-cache",
      next: { revalidate: 60 },
    }
  );
}

export async function searchProducts(
  q: string,
  limit = 8,
  lang: SupportedLanguage = DEFAULT_LANGUAGE,
  includePending?: boolean
): Promise<PaginatedResult<Product>> {
  const searchParams = new URLSearchParams({
    q,
    limit: String(limit),
    lang,
  });
  if (includePending) {
    searchParams.set("includePending", "true");
  }
  return fetchJson<PaginatedResult<Product>>(
    `/api/products/search?${searchParams}`,
    {
      cache: "no-store",
    }
  );
}

export async function incrementReviewView(
  reviewId: string
): Promise<{ id: string; views: number }> {
  return fetchJson<{ id: string; views: number }>(
    `/api/reviews/${encodeURIComponent(reviewId)}/view`,
    { method: "POST", cache: "no-store" }
  );
}

export async function getReviewComments(
  reviewId: string,
  limit = 10,
  cursor?: string | null
): Promise<CursorResult<Comment>> {
  const searchParams = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    searchParams.set("cursor", cursor);
  }
  return fetchJson<CursorResult<Comment>>(
    `/api/reviews/${reviewId}/comments?${searchParams}`
  );
}

export async function searchReviews(
  query: string,
  page = 1,
  pageSize = 10,
  categoryId?: number,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<PaginatedResult<Review>> {
  const searchParams = new URLSearchParams({
    q: query,
    page: String(page),
    pageSize: String(pageSize),
    lang,
  });
  if (categoryId) {
    searchParams.set("categoryId", String(categoryId));
  }
  return fetchJson<PaginatedResult<Review>>(`/api/search?${searchParams}`, {
    cache: "force-cache",
    next: { revalidate: 30 },
  });
}

export async function getCategories(
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Category[]> {
  const searchParams = new URLSearchParams({ lang });
  return fetchJson<PaginatedResult<Category>>(
    `/api/categories?${searchParams}`,
    {
      cache: "force-cache",
      next: { revalidate: 3600 },
    }
  ).then((result) => result.items);
}

export async function getSubcategories(
  id: number,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Category[]> {
  const searchParams = new URLSearchParams({ lang });
  return fetchJson<PaginatedResult<Category>>(
    `/api/categories/${id}/subcategories?${searchParams}`,
    {
      cache: "force-cache",
      next: { revalidate: 3600 },
    }
  ).then((result) => result.items);
}
