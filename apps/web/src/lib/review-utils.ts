import type { Category, StarType } from "@/src/types";

function buildDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const AVATAR_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="32" fill="#e2e8f0"/>
<circle cx="32" cy="24" r="12" fill="#94a3b8"/>
<path d="M16 54c4-10 12-16 16-16s12 6 16 16" fill="#94a3b8"/>
</svg>`;

const REVIEW_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
<rect width="160" height="120" rx="12" fill="#e2e8f0"/>
<circle cx="122" cy="34" r="12" fill="#94a3b8"/>
<path d="M20 96l34-34 26 26 20-20 40 40H20z" fill="#cbd5f5"/>
</svg>`;

export const DEFAULT_AVATAR = buildDataUrl(AVATAR_PLACEHOLDER_SVG);
export const DEFAULT_REVIEW_IMAGE = buildDataUrl(REVIEW_PLACEHOLDER_SVG);
export const DEFAULT_THUMBNAIL = DEFAULT_REVIEW_IMAGE;

export const FALLBACK_REVIEW_IMAGES = [DEFAULT_REVIEW_IMAGE];
export const FALLBACK_AVATARS = [DEFAULT_AVATAR];
export const FALLBACK_PROFILE_IMAGES = [DEFAULT_AVATAR];
export const FALLBACK_THUMBNAILS = [DEFAULT_THUMBNAIL];

export function pickFrom(list: string[], index: number): string {
  if (list.length === 0) {
    return "";
  }
  const safeIndex = Math.abs(index) % list.length;
  return list[safeIndex];
}

export function buildRatingStars(rating?: number): StarType[] {
  const safeRating = Math.max(0, Math.min(5, rating ?? 0));
  const stars: StarType[] = [];

  for (let i = 1; i <= 5; i += 1) {
    if (safeRating >= i) {
      stars.push("full");
      continue;
    }
    if (safeRating >= i - 0.5) {
      stars.push("half");
      continue;
    }
    stars.push("empty");
  }

  return stars;
}

export function formatRelativeTime(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 30) {
    return "just now";
  }
  if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}

export function formatCompactNumber(value?: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value?: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

export function getCategoryLabel(
  categories: Category[],
  categoryId?: number
): string | undefined {
  if (!categoryId) {
    return undefined;
  }
  return categories.find((category) => category.id === categoryId)?.name;
}

export function getCategoryMeta(label?: string): {
  icon: string;
  className: string;
  label: string;
} {
  const fallback = label ?? "General";
  const normalized = fallback.toLowerCase();

  if (normalized.includes("beauty") || normalized.includes("skin")) {
    return { icon: "face", className: "text-pink-500", label: fallback };
  }
  if (normalized.includes("travel") || normalized.includes("hotel")) {
    return { icon: "flight_takeoff", className: "text-green-600", label: fallback };
  }
  if (normalized.includes("book")) {
    return { icon: "menu_book", className: "text-purple-600", label: fallback };
  }
  if (normalized.includes("auto") || normalized.includes("car")) {
    return { icon: "directions_car", className: "text-orange-600", label: fallback };
  }
  if (normalized.includes("movie") || normalized.includes("film")) {
    return { icon: "movie", className: "text-indigo-600", label: fallback };
  }
  if (normalized.includes("tech") || normalized.includes("phone")) {
    return { icon: "smartphone", className: "text-primary", label: fallback };
  }

  return { icon: "category", className: "text-primary", label: fallback };
}
