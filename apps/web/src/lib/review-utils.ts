import type { Category, StarType } from "@/src/types";

export const FALLBACK_REVIEW_IMAGES = [
  "/stitch_assets/images/img-011.png",
  "/stitch_assets/images/img-012.png",
  "/stitch_assets/images/img-013.png",
  "/stitch_assets/images/img-014.png",
  "/stitch_assets/images/img-015.png",
  "/stitch_assets/images/img-017.png",
];

export const FALLBACK_AVATARS = [
  "/stitch_assets/images/img-004.png",
  "/stitch_assets/images/img-005.png",
  "/stitch_assets/images/img-006.png",
  "/stitch_assets/images/img-007.png",
  "/stitch_assets/images/img-008.png",
  "/stitch_assets/images/img-009.png",
  "/stitch_assets/images/img-010.png",
  "/stitch_assets/images/img-026.png",
  "/stitch_assets/images/img-027.png",
];

export const FALLBACK_PROFILE_IMAGES = [
  "/stitch_assets/images/img-057.png",
  "/stitch_assets/images/img-033.png",
  "/stitch_assets/images/img-035.png",
];

export const FALLBACK_THUMBNAILS = [
  "/stitch_assets/images/img-058.png",
  "/stitch_assets/images/img-059.png",
  "/stitch_assets/images/img-060.png",
];

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
