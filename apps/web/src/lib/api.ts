import type {
  Category,
  Comment,
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardTimeframe,
  PaginationInfo,
  Product,
  Review,
  SearchSuggestion,
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
  timeoutMs?: number;
};

// Hardcoded fallback for production environment where env vars might be missing in client bundle
const FALLBACK_API_URL = "https://irecommend-api.usercomments.workers.dev";
const DEFAULT_TIMEOUT_MS = 8000;

const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || FALLBACK_API_URL;
const BASE_URL = RAW_BASE_URL?.replace(/\/$/, "");

function getBaseUrl(): string {
  if (!BASE_URL) {
    console.warn("NEXT_PUBLIC_API_BASE_URL is not set, using fallback");
    return FALLBACK_API_URL;
  }
  return BASE_URL;
}

async function fetchJson<T>(path: string, init?: FetchOptions): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const method = init?.method ?? "GET";
  let response: Response;
  const { timeoutMs, signal, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }
  const resolvedTimeout =
    typeof timeoutMs === "number" ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const timeoutId =
    resolvedTimeout > 0
      ? setTimeout(() => controller.abort(), resolvedTimeout)
      : null;

  try {
    response = await fetch(url, {
      ...fetchInit,
      cache: init?.cache ?? "no-store",
      signal: controller.signal,
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
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
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
  timeWindow?: "6h" | "24h" | "week",
  fetchOptions?: FetchOptions
): Promise<Review[]> {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    lang,
  });
  if (timeWindow) {
    searchParams.set("timeWindow", timeWindow);
  }
  const options: FetchOptions = {
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
    next: { revalidate: 60 },
    ...fetchOptions,
  };
  return fetchJson<CursorResult<Review>>(

    `/api/reviews/latest?${searchParams}`,
    options
  );
}

export async function getLatestComments(
  limit = 5,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<{ items: Comment[] }> {
  const searchParams = new URLSearchParams({ limit: String(limit), lang });
  return fetchJson<{ items: Comment[] }>(
    `/api/comments/latest?${searchParams}`,
    { next: { revalidate: 60 } }
  );
}

export async function getLeaderboard(
  metric: LeaderboardMetric,
  timeframe: LeaderboardTimeframe,
  page: number,
  pageSize: number,
  lang: SupportedLanguage = DEFAULT_LANGUAGE,
  fetchOptions?: FetchOptions
): Promise<PaginatedResult<LeaderboardEntry>> {
  const searchParams = new URLSearchParams({
    metric,
    timeframe,
    page: String(page),
    pageSize: String(pageSize),
    lang,
  });
  const options: FetchOptions = {
    next: { revalidate: 60 },
    ...fetchOptions,
  };
  return fetchJson<PaginatedResult<LeaderboardEntry>>(
    `/api/leaderboard?${searchParams}`,
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
    next: { revalidate: 60 },
  });
}

export async function getUserProfile(username: string): Promise<UserProfile> {
  return fetchJson<UserProfile>(`/api/users/${encodeURIComponent(username)}`, {
    next: { revalidate: 60 },
  });
}

type FollowingListResponse = {
  items: Array<{ username?: string } | string>;
};

type FollowActionResponse = {
  ok: boolean;
};

export async function getMyFollowing(
  accessToken: string,
  usernames?: string[]
): Promise<string[]> {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }
  const searchParams = new URLSearchParams();
  if (usernames && usernames.length > 0) {
    searchParams.set("usernames", usernames.join(","));
  }
  const query = searchParams.toString();
  const result = await fetchJson<FollowingListResponse>(
    query ? `/api/users/me/following?${query}` : "/api/users/me/following",
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  return result.items
    .map((item) => (typeof item === "string" ? item : item.username))
    .filter((username): username is string => Boolean(username));
}

export async function followUser(
  username: string,
  accessToken: string
): Promise<FollowActionResponse> {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }
  return fetchJson<FollowActionResponse>(
    `/api/users/${encodeURIComponent(username)}/follow`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}

export async function unfollowUser(
  username: string,
  accessToken: string
): Promise<FollowActionResponse> {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }
  return fetchJson<FollowActionResponse>(
    `/api/users/${encodeURIComponent(username)}/unfollow`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
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
    `/api/reviews/slug/${encodeURIComponent(slug)}?${searchParams}`,
    {
      next: { revalidate: 90 },
    }
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
      next: { revalidate: 60 },
    }
  );
}

export async function searchProducts(
  q: string,
  limit = 8,
  lang: SupportedLanguage = DEFAULT_LANGUAGE,
  includePending?: boolean,
  signal?: AbortSignal
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
      next: { revalidate: 30 },
      signal,
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
    `/api/reviews/${reviewId}/comments?${searchParams}`,
    {
      next: { revalidate: 30 },
    }
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
    next: { revalidate: 30 },
  });
}

export async function searchSuggestions(
  query: string,
  limit = 8,
  lang: SupportedLanguage = DEFAULT_LANGUAGE,
  signal?: AbortSignal
): Promise<PaginatedResult<SearchSuggestion>> {
  const searchParams = new URLSearchParams({
    q: query,
    limit: String(limit),
    lang,
  });
  return fetchJson<PaginatedResult<SearchSuggestion>>(
    `/api/search/suggest?${searchParams}`,
    {
      next: { revalidate: 30 },
      timeoutMs: 4000,
      signal,
    }
  );
}

export async function getCategories(
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Category[]> {
  const searchParams = new URLSearchParams({ lang });
  return fetchJson<PaginatedResult<Category>>(
    `/api/categories?${searchParams}`,
    {
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
      next: { revalidate: 3600 },
    }
  ).then((result) => result.items);
}
