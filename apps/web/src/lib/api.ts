import type {
  Category,
  Comment,
  PaginationInfo,
  Review,
  UserProfile,
} from "@/src/types";

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

const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
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
  const response = await fetch(url, {
    ...init,
    cache: init?.cache ?? "no-store",
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `API request failed (${response.status} ${response.statusText}): ${message}`
    );
  }

  return response.json() as Promise<T>;
}

export async function getPopularReviews(limit = 3): Promise<Review[]> {
  return fetchJson<PaginatedResult<Review>>(
    `/api/reviews/popular?limit=${limit}`,
    {
      cache: "force-cache",
      next: { revalidate: 45 },
    }
  ).then((result) => result.items);
}

export async function getLatestReviews(
  limit = 3,
  cursor?: string | null
): Promise<CursorResult<Review>> {
  const searchParams = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    searchParams.set("cursor", cursor);
  }
  return fetchJson<CursorResult<Review>>(`/api/reviews/latest?${searchParams}`, {
    cache: "force-cache",
    next: { revalidate: 45 },
  });
}

export async function getCatalogPage(
  page: number,
  pageSize: number,
  sort: "latest" | "popular" | "rating" = "latest",
  categoryId?: number
): Promise<PaginatedResult<Review>> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
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
  subCategoryId?: number
): Promise<PaginatedResult<Review>> {
  const searchParams = new URLSearchParams({
    categoryId: String(id),
    page: String(page),
    pageSize: String(pageSize),
    sort,
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
  pageSize: number
): Promise<PaginatedResult<Review>> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return fetchJson<PaginatedResult<Review>>(
    `/api/users/${encodeURIComponent(username)}/reviews?${searchParams}`,
    {
      cache: "force-cache",
      next: { revalidate: 60 },
    }
  );
}

export async function getReviewBySlug(slug: string): Promise<Review> {
  return fetchJson<Review>(`/api/reviews/slug/${encodeURIComponent(slug)}`);
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
  categoryId?: number
): Promise<PaginatedResult<Review>> {
  const searchParams = new URLSearchParams({
    q: query,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (categoryId) {
    searchParams.set("categoryId", String(categoryId));
  }
  return fetchJson<PaginatedResult<Review>>(`/api/search?${searchParams}`, {
    cache: "force-cache",
    next: { revalidate: 30 },
  });
}

export async function getCategories(): Promise<Category[]> {
  return fetchJson<PaginatedResult<Category>>("/api/categories", {
    cache: "force-cache",
    next: { revalidate: 3600 },
  }).then((result) => result.items);
}

export async function getSubcategories(id: number): Promise<Category[]> {
  return fetchJson<PaginatedResult<Category>>(
    `/api/categories/${id}/subcategories`,
    {
      cache: "force-cache",
      next: { revalidate: 3600 },
    }
  ).then((result) => result.items);
}
