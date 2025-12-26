import type {
  Category,
  Comment,
  Product,
  ProductImage,
  ProductStats,
  ProductStatus,
  BrandStatus,
  Review,
  UserProfile,
} from "../types";

type DbProfile = {
  user_id: string;
  username: string;
  bio: string | null;
  profile_pic_url: string | null;
  created_at?: string | null;
};

type DbCategory = {
  id: number;
  name: string;
  parent_id: number | null;
};

type DbReview = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html?: string | null;
  review_translations?:
  | {
    lang: string;
    slug: string;
    title?: string | null;
    excerpt?: string | null;
    content_html?: string | null;
    meta_title?: string | null;
    meta_description?: string | null;
    summary?: string | null;
    faq?: unknown;
    specs?: unknown;
    pros?: unknown;
    cons?: unknown;
  }[]
  | null;
  rating_avg?: number | string | null;
  rating_count?: number | string | null;
  views?: number | string | null;
  votes_up?: number | string | null;
  votes_down?: number | string | null;
  photo_urls?: unknown;
  photo_count?: number | string | null;
  comment_count?: number | string | null;
  recommend?: boolean | null;
  pros?: unknown;
  cons?: unknown;
  category_id?: number | string | null;
  sub_category_id?: number | string | null;
  product_id?: string | null;
  created_at: string;
  profiles?:
  | {
    username: string | null;
    profile_pic_url: string | null;
  }
  | {
    username: string | null;
    profile_pic_url: string | null;
  }[]
  | null;
  products?:
  | {
    id: string | null;
    slug: string | null;
    name: string | null;
  }
  | {
    id: string | null;
    slug: string | null;
    name: string | null;
  }[]
  | null;
};

type DbComment = {
  id: string;
  review_id: string;
  text: string;
  created_at: string;
  profiles?:
  | {
    username: string | null;
    profile_pic_url: string | null;
  }
  | {
    username: string | null;
    profile_pic_url: string | null;
  }[]
  | null;
  reviews?:
  | {
    slug: string | null;
    title: string | null;
  }
  | {
    slug: string | null;
    title: string | null;
  }[]
  | null;
};

type DbProductTranslation = {
  lang: string;
  slug: string;
  name?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
};

type DbProductImage = {
  id: string;
  url: string;
  sort_order?: number | null;
};

type DbProductStats = {
  review_count?: number | string | null;
  rating_avg?: number | string | null;
  rating_count?: number | string | null;
  recommend_up?: number | string | null;
  recommend_down?: number | string | null;
  photo_count?: number | string | null;
};

type DbProductRow = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  brand_id?: string | null;
  brands?:
  | {
    id: string | null;
    slug: string | null;
    name: string | null;
    status?: string | null;
  }
  | {
    id: string | null;
    slug: string | null;
    name: string | null;
    status?: string | null;
  }[]
  | null;
  product_translations?: DbProductTranslation[] | null;
  product_images?: DbProductImage[] | null;
  product_stats?: DbProductStats | DbProductStats[] | null;
  product_categories?: { category_id: number | null }[] | null;
};

function fixUrl(url: string | null | undefined, r2BaseUrl?: string): string | undefined {
  if (!url) return undefined;
  if (r2BaseUrl && url.includes(".r2.dev")) {
    return url.replace(/https:\/\/[^/]+\.r2\.dev/g, r2BaseUrl);
  }
  return url;
}

export function mapCategoryRow(row: DbCategory): Category {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
  };
}

export function mapProfileRow(
  row: DbProfile,
  options?: { r2BaseUrl?: string }
): UserProfile {
  return {
    username: row.username,
    displayName: row.username,
    bio: row.bio ?? undefined,
    profilePicUrl: fixUrl(row.profile_pic_url, options?.r2BaseUrl),
    createdAt: row.created_at ?? undefined,
  };
}

export function mapReviewRow(
  row: DbReview,
  options?: { lang?: string; includeTranslations?: boolean; r2BaseUrl?: string }
): Review {
  const profile = pickRelation(row.profiles);
  const product = pickRelation(row.products);

  const translations = Array.isArray(row.review_translations)
    ? row.review_translations
      .filter((item): item is NonNullable<DbReview["review_translations"]>[number] =>
        Boolean(item)
      )
      .map((translation) => ({
        lang: translation.lang,
        slug: translation.slug,
        title: translation.title,
        excerpt: translation.excerpt ?? undefined,
        contentHtml: translation.content_html ?? undefined,
        metaTitle: translation.meta_title ?? undefined,
        metaDescription: translation.meta_description ?? undefined,
        summary: translation.summary ?? undefined,
        faq: translation.faq,
        specs: translation.specs,
        pros: translation.pros,
        cons: translation.cons,
      }))
    : [];
  const preferredTranslation = options?.lang
    ? translations.find((translation) => translation.lang === options.lang)
    : translations[0];
  const photoUrls = normalizeStringArray(row.photo_urls)
    ?.map((u) => fixUrl(u, options?.r2BaseUrl))
    .filter((u): u is string => !!u);
  const pros = normalizeStringArray(preferredTranslation?.pros);
  const cons = normalizeStringArray(preferredTranslation?.cons);
  const excerpt = preferredTranslation?.excerpt ?? row.excerpt ?? "";
  const contentHtml = resolveReviewContentHtml(
    preferredTranslation?.contentHtml ?? row.content_html ?? undefined,
    excerpt
  );

  const ratingAvg = normalizeNumber(row.rating_avg);
  const ratingCount = normalizeNumber(row.rating_count);
  const views = normalizeNumber(row.views);
  const votesUp = normalizeNumber(row.votes_up);
  const votesDown = normalizeNumber(row.votes_down);
  const photoCount = normalizeNumber(row.photo_count);
  const commentCount = normalizeNumber(row.comment_count);
  const categoryId = normalizeNumber(row.category_id);
  const subCategoryId = normalizeNumber(row.sub_category_id);

  return {
    id: row.id,
    translationLang: preferredTranslation?.lang,
    slug: preferredTranslation?.slug ?? row.slug,
    title: preferredTranslation?.title ?? row.title,
    excerpt,
    contentHtml,
    metaTitle: preferredTranslation?.metaTitle,
    metaDescription: preferredTranslation?.metaDescription,
    translations: options?.includeTranslations
      ? translations.map((translation) => ({
        lang: translation.lang,
        slug: translation.slug,
      }))
      : undefined,
    ratingAvg,
    ratingCount,
    views,
    votesUp,
    votesDown,
    photoCount: photoCount ?? photoUrls?.length,
    photoUrls,
    commentCount,
    recommend: row.recommend ?? undefined,
    pros,
    cons,
    summary: preferredTranslation?.summary ?? undefined,
    faq: (preferredTranslation?.faq as any) ?? undefined,
    specs: (preferredTranslation?.specs as any) ?? undefined,
    author: {
      username: profile?.username ?? "unknown",
      displayName: profile?.username ?? undefined,
      profilePicUrl: fixUrl(profile?.profile_pic_url, options?.r2BaseUrl),
    },
    createdAt: row.created_at,
    categoryId: categoryId ?? undefined,
    subCategoryId: subCategoryId ?? undefined,
    productId: row.product_id ?? undefined,
    product: product?.id
      ? {
        id: product.id,
        slug: product.slug ?? "",
        name: product.name ?? "",
      }
      : undefined,
  };
}

export function mapCommentRow(
  row: DbComment,
  options?: { r2BaseUrl?: string }
): Comment {
  const profile = pickRelation(row.profiles);
  const review = pickRelation(row.reviews);
  return {
    id: row.id,
    reviewId: row.review_id,
    text: row.text,
    createdAt: row.created_at,
    author: {
      username: profile?.username ?? "unknown",
      displayName: profile?.username ?? undefined,
      profilePicUrl: fixUrl(profile?.profile_pic_url, options?.r2BaseUrl),
    },
    review:
      review?.slug && review?.title
        ? {
          slug: review.slug,
          title: review.title,
        }
        : undefined,
  };
}

export function mapProductRow(
  row: DbProductRow,
  options?: { lang?: string; includeTranslations?: boolean; r2BaseUrl?: string }
): Product {
  const translation = Array.isArray(row.product_translations)
    ? row.product_translations.find((item) => item.lang === options?.lang) ??
    row.product_translations[0]
    : undefined;
  const images: ProductImage[] | undefined = Array.isArray(row.product_images)
    ? row.product_images.map((image) => ({
      id: image.id,
      url: fixUrl(image.url, options?.r2BaseUrl) ?? image.url,
      sortOrder: normalizeNumber(image.sort_order),
    }))
    : undefined;
  const statsRow = pickRelation(row.product_stats);
  const stats: ProductStats | undefined = statsRow
    ? {
      reviewCount: normalizeNumber(statsRow.review_count),
      ratingAvg: normalizeNumber(statsRow.rating_avg),
      ratingCount: normalizeNumber(statsRow.rating_count),
      recommendUp: normalizeNumber(statsRow.recommend_up),
      recommendDown: normalizeNumber(statsRow.recommend_down),
      photoCount: normalizeNumber(statsRow.photo_count),
    }
    : undefined;
  const brand = pickRelation(row.brands);
  const categoryIds = Array.isArray(row.product_categories)
    ? row.product_categories
      .map((item) => (item.category_id ? Number(item.category_id) : null))
      .filter((item): item is number => typeof item === "number")
    : undefined;

  return {
    id: row.id,
    translationLang: translation?.lang,
    slug: translation?.slug ?? row.slug,
    name: translation?.name ?? row.name,
    description: translation?.description ?? row.description ?? undefined,
    status: (row.status as ProductStatus) ?? undefined,
    brand: brand?.id
      ? {
        id: brand.id,
        slug: brand.slug ?? "",
        name: brand.name ?? "",
        status: (brand.status as BrandStatus) ?? undefined,
      }
      : undefined,
    categoryIds: categoryIds && categoryIds.length > 0 ? categoryIds : undefined,
    images,
    stats,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    translations: options?.includeTranslations
      ? Array.isArray(row.product_translations)
        ? row.product_translations
          .filter((item) => Boolean(item.lang && item.slug))
          .map((item) => ({ lang: item.lang, slug: item.slug }))
        : undefined
      : undefined,
  };
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveReviewContentHtml(
  primary: string | null | undefined,
  fallback: string | null | undefined
): string | undefined {
  if (primary && primary.trim().length > 0) {
    const stripped = stripHtml(primary);
    if (stripped.length > 0) {
      return primary;
    }
  }
  if (fallback && fallback.trim().length > 0) {
    return fallback;
  }
  return primary ?? undefined;
}

function normalizeNumber(
  value: number | string | null | undefined
): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!value) {
    return undefined;
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
      return undefined;
    }
  }
  return undefined;
}

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}
