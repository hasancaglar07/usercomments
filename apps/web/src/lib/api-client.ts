import { getAccessToken } from "./auth";

const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const BASE_URL = RAW_BASE_URL?.replace(/\/$/, "");

function getBaseUrl(): string {
  if (!BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return BASE_URL;
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const baseUrl = getBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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

export async function createReview(payload: {
  title: string;
  excerpt: string;
  contentHtml: string;
  rating: number;
  categoryId: number;
  subCategoryId?: number;
  photoUrls: string[];
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

export async function presignUpload(payload: {
  filename: string;
  contentType: string;
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  return authFetch("/api/uploads/presign", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
