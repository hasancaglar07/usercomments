import type { Category, StarType } from "@/src/types";
import {
  DEFAULT_LANGUAGE,
  getLocale,
  type SupportedLanguage,
} from "@/src/lib/i18n";

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

const JUST_NOW: Record<SupportedLanguage, string> = {
  en: "just now",
  tr: "az önce",
  es: "justo ahora",
  de: "gerade eben",
  ar: "الآن",
};

export function formatRelativeTime(
  value?: string,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 0) {
    return "";
  }

  if (diffSeconds < 30) {
    return JUST_NOW[lang] ?? JUST_NOW[DEFAULT_LANGUAGE];
  }
  const rtf = new Intl.RelativeTimeFormat(getLocale(lang), {
    numeric: "auto",
  });
  if (diffSeconds < 60) {
    return rtf.format(-diffSeconds, "second");
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return rtf.format(-diffMinutes, "minute");
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return rtf.format(-diffHours, "hour");
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return rtf.format(-diffDays, "day");
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return rtf.format(-diffWeeks, "week");
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return rtf.format(-diffMonths, "month");
  }

  const diffYears = Math.floor(diffDays / 365);
  return rtf.format(-diffYears, "year");
}

export function formatCompactNumber(
  value?: number,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0";
  }

  return new Intl.NumberFormat(getLocale(lang), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(
  value?: number,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0";
  }

  return new Intl.NumberFormat(getLocale(lang)).format(value);
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

  if (
    normalized.includes("beauty") ||
    normalized.includes("skin") ||
    normalized.includes("güzellik") ||
    normalized.includes("belleza") ||
    normalized.includes("schön") ||
    normalized.includes("الجمال")
  ) {
    return { icon: "face", className: "text-pink-500", label: fallback };
  }
  if (
    normalized.includes("travel") ||
    normalized.includes("hotel") ||
    normalized.includes("seyahat") ||
    normalized.includes("viaje") ||
    normalized.includes("reisen") ||
    normalized.includes("السفر")
  ) {
    return { icon: "flight_takeoff", className: "text-green-600", label: fallback };
  }
  if (
    normalized.includes("book") ||
    normalized.includes("kitap") ||
    normalized.includes("libro") ||
    normalized.includes("bücher") ||
    normalized.includes("كتاب")
  ) {
    return { icon: "menu_book", className: "text-purple-600", label: fallback };
  }
  if (
    normalized.includes("auto") ||
    normalized.includes("car") ||
    normalized.includes("otomotiv") ||
    normalized.includes("araba") ||
    normalized.includes("automotriz") ||
    normalized.includes("coche") ||
    normalized.includes("سيارة")
  ) {
    return { icon: "directions_car", className: "text-orange-600", label: fallback };
  }
  if (
    normalized.includes("movie") ||
    normalized.includes("film") ||
    normalized.includes("sinema") ||
    normalized.includes("película") ||
    normalized.includes("cine") ||
    normalized.includes("أفلام")
  ) {
    return { icon: "movie", className: "text-indigo-600", label: fallback };
  }
  if (
    normalized.includes("tech") ||
    normalized.includes("phone") ||
    normalized.includes("teknoloji") ||
    normalized.includes("telefon") ||
    normalized.includes("tecnología") ||
    normalized.includes("móvil") ||
    normalized.includes("technik") ||
    normalized.includes("هاتف") ||
    normalized.includes("تقنية")
  ) {
    return { icon: "smartphone", className: "text-primary", label: fallback };
  }

  return { icon: "category", className: "text-primary", label: fallback };
}
