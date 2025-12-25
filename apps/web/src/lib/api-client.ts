import type {
  AdminComment,
  AdminProduct,
  AdminReport,
  AdminReview,
  AdminUser,
  AdminUserDetail,
  Category,
  CategoryTranslation,
  CommentStatus,
  PaginationInfo,
  ProductTranslation,
  ProductStatus,
  Report,
  ReportStatus,
  ReportTargetType,
  Review,
  ReviewStatus,
  UploadHealth,
  UserRole,
  UserProfile,
} from "@/src/types";
import type { SupportedLanguage } from "@/src/lib/i18n";
import { getAccessToken } from "./auth";

type PaginatedResult<T> = {
  items: T[];
  pageInfo: PaginationInfo;
};

export type BulkUpdateResult<T> = {
  succeeded: T[];
  failed: Array<{ id: string; error: string }>;
};

const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const BASE_URL = RAW_BASE_URL?.replace(/\/$/, "");

function getBaseUrl(): string {
  if (!BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return BASE_URL;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error.";
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const baseUrl = getBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const method = init?.method ?? "GET";
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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

async function runBulkUpdate<T>(
  ids: string[],
  action: (id: string) => Promise<T>
): Promise<BulkUpdateResult<T>> {
  const result: BulkUpdateResult<T> = { succeeded: [], failed: [] };

  for (const id of ids) {
    try {
      const updated = await action(id);
      result.succeeded.push(updated);
    } catch (error) {
      result.failed.push({ id, error: getErrorMessage(error) });
    }
  }

  return result;
}

export async function createReview(payload: {
  title: string;
  excerpt: string;
  contentHtml: string;
  rating: number;
  recommend?: boolean;
  pros?: string[];
  cons?: string[];
  categoryId: number;
  subCategoryId?: number;
  productId?: string;
  productName?: string;
  photoUrls: string[];
  productPhotoUrl?: string;
  lang?: SupportedLanguage;
}): Promise<{ id: string; slug: string }> {
  return authFetch<{ id: string; slug: string }>("/api/reviews", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createComment(reviewId: string, text: string) {
  return authFetch(`/api/reviews/${reviewId}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function voteReview(reviewId: string, type: "up" | "down") {
  return authFetch(`/api/reviews/${reviewId}/vote`, {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}

export async function reportReview(
  reviewId: string,
  payload: { reason: string; details?: string }
): Promise<Report> {
  return authFetch<Report>(`/api/reviews/${encodeURIComponent(reviewId)}/report`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function presignUpload(payload: {
  filename: string;
  contentType: string;
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  return authFetch("/api/uploads/presign", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProfile(): Promise<UserProfile> {
  return authFetch<UserProfile>("/api/profile");
}

export async function updateProfile(payload: {
  username?: string;
  bio?: string | null;
  profilePicUrl?: string | null;
}): Promise<UserProfile> {
  return authFetch<UserProfile>("/api/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getAdminCategories(): Promise<PaginatedResult<Category>> {
  return authFetch<PaginatedResult<Category>>("/api/admin/categories");
}

export async function createAdminCategory(payload: {
  name: string;
  parentId?: number | null;
}): Promise<Category> {
  return authFetch<Category>("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminCategory(
  id: number,
  payload: { name?: string; parentId?: number | null }
): Promise<Category> {
  return authFetch<Category>(`/api/admin/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getAdminCategoryTranslations(
  id: number
): Promise<PaginatedResult<CategoryTranslation>> {
  return authFetch<PaginatedResult<CategoryTranslation>>(
    `/api/admin/categories/${id}/translations`
  );
}

export async function updateAdminCategoryTranslations(
  id: number,
  payload: { translations: Array<Pick<CategoryTranslation, "lang" | "name" | "slug">> }
): Promise<PaginatedResult<CategoryTranslation>> {
  return authFetch<PaginatedResult<CategoryTranslation>>(
    `/api/admin/categories/${id}/translations`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function getAdminUploadHealth(): Promise<UploadHealth> {
  return authFetch<UploadHealth>("/api/admin/uploads/health");
}

export async function getAdminProducts(options: {
  q?: string;
  status?: ProductStatus;
  page?: number;
  pageSize?: number;
  lang?: SupportedLanguage;
}): Promise<PaginatedResult<AdminProduct>> {
  const params = new URLSearchParams();
  if (options.q) {
    params.set("q", options.q);
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.page) {
    params.set("page", String(options.page));
  }
  if (options.pageSize) {
    params.set("pageSize", String(options.pageSize));
  }
  if (options.lang) {
    params.set("lang", options.lang);
  }
  const query = params.toString();
  return authFetch<PaginatedResult<AdminProduct>>(
    `/api/admin/products${query ? `?${query}` : ""}`
  );
}

export async function getAdminProductDetail(
  id: string,
  lang?: SupportedLanguage
): Promise<AdminProduct> {
  const params = new URLSearchParams();
  if (lang) {
    params.set("lang", lang);
  }
  const query = params.toString();
  return authFetch<AdminProduct>(
    `/api/admin/products/${id}${query ? `?${query}` : ""}`
  );
}

export async function getAdminProductTranslations(
  id: string
): Promise<PaginatedResult<ProductTranslation>> {
  return authFetch<PaginatedResult<ProductTranslation>>(
    `/api/admin/products/${id}/translations`
  );
}

export async function updateAdminProductTranslations(
  id: string,
  payload: {
    translations: Array<
      Pick<ProductTranslation, "lang" | "name"> & {
        description?: string | null;
        metaTitle?: string | null;
        metaDescription?: string | null;
      }
    >;
  }
): Promise<PaginatedResult<ProductTranslation>> {
  return authFetch<PaginatedResult<ProductTranslation>>(
    `/api/admin/products/${id}/translations`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function createAdminProduct(
  payload: {
    name: string;
    description?: string | null;
    status?: ProductStatus;
    brandId?: string | null;
    categoryIds?: number[];
    imageUrls?: string[];
  },
  lang?: SupportedLanguage
): Promise<AdminProduct> {
  const params = new URLSearchParams();
  if (lang) {
    params.set("lang", lang);
  }
  const query = params.toString();
  return authFetch<AdminProduct>(`/api/admin/products${query ? `?${query}` : ""}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminProduct(
  id: string,
  payload: {
    name?: string;
    description?: string | null;
    status?: ProductStatus;
    brandId?: string | null;
    categoryIds?: number[] | null;
    imageUrls?: string[] | null;
  },
  lang?: SupportedLanguage
): Promise<AdminProduct> {
  const params = new URLSearchParams();
  if (lang) {
    params.set("lang", lang);
  }
  const query = params.toString();
  return authFetch<AdminProduct>(
    `/api/admin/products/${id}${query ? `?${query}` : ""}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export async function bulkUpdateAdminProductStatus(
  ids: string[],
  status: ProductStatus,
  lang?: SupportedLanguage
): Promise<BulkUpdateResult<AdminProduct>> {
  return runBulkUpdate(ids, (id) => updateAdminProduct(id, { status }, lang));
}

export async function getAdminReviews(options: {
  q?: string;
  status?: ReviewStatus;
  page?: number;
  pageSize?: number;
  lang?: SupportedLanguage;
}): Promise<PaginatedResult<AdminReview>> {
  const params = new URLSearchParams();
  if (options.q) {
    params.set("q", options.q);
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.page) {
    params.set("page", String(options.page));
  }
  if (options.pageSize) {
    params.set("pageSize", String(options.pageSize));
  }
  if (options.lang) {
    params.set("lang", options.lang);
  }
  const query = params.toString();
  return authFetch<PaginatedResult<AdminReview>>(
    `/api/admin/reviews${query ? `?${query}` : ""}`
  );
}

export async function getAdminReviewDetail(
  id: string,
  lang?: SupportedLanguage
): Promise<AdminReview> {
  const params = new URLSearchParams();
  if (lang) {
    params.set("lang", lang);
  }
  const query = params.toString();
  return authFetch<AdminReview>(
    `/api/admin/reviews/${id}${query ? `?${query}` : ""}`
  );
}

export async function updateAdminReviewStatus(
  id: string,
  status: ReviewStatus
): Promise<{ id: string; status: ReviewStatus }> {
  return authFetch(`/api/admin/reviews/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function bulkUpdateAdminReviewStatus(
  ids: string[],
  status: ReviewStatus
): Promise<BulkUpdateResult<{ id: string; status: ReviewStatus }>> {
  return runBulkUpdate(ids, (id) => updateAdminReviewStatus(id, status));
}

export async function updateAdminReview(
  id: string,
  payload: {
    title?: string;
    excerpt?: string;
    contentHtml?: string;
    photoUrls?: string[];
    recommend?: boolean;
    pros?: string[];
    cons?: string[];
    categoryId?: number | null;
    subCategoryId?: number | null;
    productId?: string | null;
  },
  lang?: SupportedLanguage
): Promise<AdminReview> {
  const params = new URLSearchParams();
  if (lang) {
    params.set("lang", lang);
  }
  const query = params.toString();
  return authFetch(`/api/admin/reviews/${id}${query ? `?${query}` : ""}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getAdminComments(options: {
  q?: string;
  status?: CommentStatus;
  reviewId?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<AdminComment>> {
  const params = new URLSearchParams();
  if (options.q) {
    params.set("q", options.q);
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.reviewId) {
    params.set("reviewId", options.reviewId);
  }
  if (options.page) {
    params.set("page", String(options.page));
  }
  if (options.pageSize) {
    params.set("pageSize", String(options.pageSize));
  }
  const query = params.toString();
  return authFetch<PaginatedResult<AdminComment>>(
    `/api/admin/comments${query ? `?${query}` : ""}`
  );
}

export async function updateAdminComment(
  id: string,
  payload: { text: string }
): Promise<AdminComment> {
  return authFetch(`/api/admin/comments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getAdminReports(options: {
  q?: string;
  status?: ReportStatus;
  targetType?: ReportTargetType;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<AdminReport>> {
  const params = new URLSearchParams();
  if (options.q) {
    params.set("q", options.q);
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.targetType) {
    params.set("targetType", options.targetType);
  }
  if (options.page) {
    params.set("page", String(options.page));
  }
  if (options.pageSize) {
    params.set("pageSize", String(options.pageSize));
  }
  const query = params.toString();
  return authFetch<PaginatedResult<AdminReport>>(
    `/api/admin/reports${query ? `?${query}` : ""}`
  );
}

export async function updateAdminReportStatus(
  id: string,
  status: ReportStatus
): Promise<AdminReport> {
  return authFetch(`/api/admin/reports/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function bulkUpdateAdminReportStatus(
  ids: string[],
  status: ReportStatus
): Promise<BulkUpdateResult<AdminReport>> {
  return runBulkUpdate(ids, (id) => updateAdminReportStatus(id, status));
}

export async function getAdminUsers(options: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<AdminUser>> {
  const params = new URLSearchParams();
  if (options.q) {
    params.set("q", options.q);
  }
  if (options.page) {
    params.set("page", String(options.page));
  }
  if (options.pageSize) {
    params.set("pageSize", String(options.pageSize));
  }
  const query = params.toString();
  return authFetch<PaginatedResult<AdminUser>>(
    `/api/admin/users${query ? `?${query}` : ""}`
  );
}

export async function getAdminUserDetail(
  userId: string
): Promise<AdminUserDetail> {
  return authFetch<AdminUserDetail>(`/api/admin/users/${userId}`);
}

export async function updateAdminUserProfile(
  userId: string,
  payload: { username?: string; bio?: string | null; profilePicUrl?: string | null }
): Promise<AdminUserDetail> {
  return authFetch<AdminUserDetail>(`/api/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminUserRole(
  userId: string,
  role: UserRole
): Promise<{ userId: string; role: UserRole }> {
  return authFetch(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function updateAdminCommentStatus(
  id: string,
  status: CommentStatus
): Promise<{ id: string; status: CommentStatus }> {
  return authFetch(`/api/admin/comments/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function bulkUpdateAdminCommentStatus(
  ids: string[],
  status: CommentStatus
): Promise<BulkUpdateResult<{ id: string; status: CommentStatus }>> {
  return runBulkUpdate(ids, (id) => updateAdminCommentStatus(id, status));
}

export async function getUserDrafts(
  username: string,
  page = 1,
  pageSize = 10,
  lang?: SupportedLanguage
): Promise<PaginatedResult<Review>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (lang) {
    params.set("lang", lang);
  }
  return authFetch<PaginatedResult<Review>>(
    `/api/users/${encodeURIComponent(username)}/drafts?${params}`
  );
}

export async function getUserSaved(
  username: string,
  page = 1,
  pageSize = 10,
  lang?: SupportedLanguage
): Promise<PaginatedResult<Review>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (lang) {
    params.set("lang", lang);
  }
  return authFetch<PaginatedResult<Review>>(
    `/api/users/${encodeURIComponent(username)}/saved?${params}`
  );
}
