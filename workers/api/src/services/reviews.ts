import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import type { Comment, PaginationInfo, Review, ReviewStatus } from "../types";
import { DEFAULT_LANGUAGE, isSupportedLanguage, type SupportedLanguage } from "../utils/i18n";
import { buildPaginationInfo } from "../utils/pagination";
import { slugify } from "../utils/slug";
import { mapCommentRow, mapReviewRow } from "./mappers";
import { attachProductImage, findOrCreateProduct } from "./products";

type ReviewSort = "latest" | "popular" | "rating";

type ReviewListResult = {
  items: Review[];
  pageInfo: PaginationInfo;
};

type CursorResult<T> = {
  items: T[];
  nextCursor: string | null;
};

type DbReviewTranslationRow = {
  lang: string;
  slug: string;
  title?: string | null;
  excerpt?: string | null;
  content_html?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
};

type DbReviewRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html?: string | null;
  review_translations?: DbReviewTranslationRow[] | null;
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

type ReviewWithCountRow = DbReviewRow & {
  total_count?: number | string | null;
};

const HIDDEN_REVIEW_TITLE = "Review not available";
const HIDDEN_REVIEW_EXCERPT = "This review is currently unavailable.";

const reviewListSelect = `
  id,
  slug,
  title,
  excerpt,
  rating_avg,
  rating_count,
  views,
  votes_up,
  votes_down,
  photo_urls,
  photo_count,
  comment_count,
  recommend,
  pros,
  cons,
  category_id,
  sub_category_id,
  product_id,
  created_at,
  profiles(username, profile_pic_url),
  products(id, slug, name)
`;

const reviewDetailSelect = `
  ${reviewListSelect},
  content_html,
  status
`;

const reviewTranslationSelect = `
  review_translations!inner(
    lang,
    slug,
    title,
    excerpt,
    content_html,
    meta_title,
    meta_description
  )
`;

const reviewListSelectWithTranslations = `
  ${reviewListSelect},
  ${reviewTranslationSelect}
`;

type CreateReviewPayload = {
  title: string;
  excerpt: string;
  contentHtml: string;
  rating: number;
  categoryId: number;
  subCategoryId?: number | null;
  productId?: string | null;
  productName?: string | null;
  pros?: string[];
  cons?: string[];
  recommend?: boolean;
  photoUrls: string[];
  productPhotoUrl?: string | null;
  userId: string;
  lang: SupportedLanguage;
};

export async function fetchPopularReviews(
  env: ParsedEnv,
  limit: number,
  lang: SupportedLanguage
): Promise<Review[]> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("reviews")
    .select(reviewListSelectWithTranslations)
    .eq("review_translations.lang", lang)
    .eq("status", "published")
    .order("votes_up", { ascending: false })
    .order("views", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapReviewRow(row as DbReviewRow, { lang }));
}

export async function fetchLatestReviews(
  env: ParsedEnv,
  cursor: string | null,
  limit: number,
  lang: SupportedLanguage
): Promise<CursorResult<Review>> {
  const supabase = getSupabaseClient(env);
  const cursorParts = cursor ? cursor.split("|") : null;
  const cursorCreatedAt = cursorParts?.[0];
  const cursorId = cursorParts?.[1];
  let query = supabase
    .from("reviews")
    .select(reviewListSelectWithTranslations)
    .eq("review_translations.lang", lang)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (cursorCreatedAt) {
    if (cursorId) {
      query = query.or(
        `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
      );
    } else {
      query = query.lt("created_at", cursorCreatedAt);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const items = (data ?? []).map((row) => mapReviewRow(row as DbReviewRow, { lang }));
  const lastItem = items.length > 0 ? items[items.length - 1] : null;
  const nextCursor =
    lastItem?.createdAt && lastItem?.id
      ? `${lastItem.createdAt}|${lastItem.id}`
      : lastItem?.createdAt ?? null;

  return { items, nextCursor };
}

export async function fetchReviews(
  env: ParsedEnv,
  options: {
    lang: SupportedLanguage;
    categoryId?: number;
    subCategoryId?: number;
    productId?: string;
    sort: ReviewSort;
    page: number;
    pageSize: number;
  }
): Promise<ReviewListResult> {
  const supabase = getSupabaseClient(env);
  const { categoryId, subCategoryId, productId, sort, page, pageSize, lang } =
    options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("reviews")
    .select(reviewListSelectWithTranslations, { count: "exact" })
    .eq("review_translations.lang", lang);

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (subCategoryId) {
    query = query.eq("sub_category_id", subCategoryId);
  }

  if (productId) {
    query = query.eq("product_id", productId);
  }

  switch (sort) {
    case "popular":
      query = query.order("votes_up", { ascending: false });
      break;
    case "rating":
      query = query
        .order("rating_avg", { ascending: false })
        .order("rating_count", { ascending: false });
      break;
    case "latest":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  query = query.eq("status", "published");

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: (data ?? []).map((row) => mapReviewRow(row as DbReviewRow, { lang })),
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function fetchReviewBySlug(
  env: ParsedEnv,
  slug: string,
  lang: SupportedLanguage
): Promise<Review | null> {
  const supabase = getSupabaseClient(env);
  const translationSelect = `
    review_id,
    lang,
    slug,
    title,
    excerpt,
    content_html,
    meta_title,
    meta_description,
    reviews(
      ${reviewDetailSelect},
      review_translations(lang, slug)
    )
  `;

  const { data, error } = await supabase
    .from("review_translations")
    .select(translationSelect)
    .eq("lang", lang)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  let translation = data as
    | (DbReviewTranslationRow & {
        review_id: string;
        reviews: (DbReviewRow & { status?: string }) | null;
      })
    | null;

  if (!translation) {
    const { data: lookup, error: lookupError } = await supabase
      .from("review_translations")
      .select("review_id")
      .eq("slug", slug)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (!lookup?.review_id) {
      return null;
    }

    const { data: fallbackTranslation, error: fallbackError } = await supabase
      .from("review_translations")
      .select(translationSelect)
      .eq("review_id", lookup.review_id)
      .eq("lang", DEFAULT_LANGUAGE)
      .maybeSingle();

    if (fallbackError) {
      throw fallbackError;
    }

    translation = fallbackTranslation as
      | (DbReviewTranslationRow & {
          review_id: string;
          reviews: (DbReviewRow & { status?: string }) | null;
        })
      | null;
  }

  if (!translation?.reviews) {
    return null;
  }

  const reviewRow = translation.reviews;
  const status = reviewRow.status ?? "published";

  if (status === "deleted" || status === "pending" || status === "draft") {
    return null;
  }

  if (status === "hidden") {
    return buildHiddenReview({
      id: reviewRow.id,
      slug: translation.slug,
      created_at: reviewRow.created_at,
      translationLang: translation.lang,
      profiles: reviewRow.profiles,
    });
  }

  const translationList = Array.isArray(reviewRow.review_translations)
    ? reviewRow.review_translations.filter(
        (item): item is { lang: string; slug: string } =>
          Boolean(item) && isSupportedLanguage(item.lang)
      )
    : [];

  const mergedReview: DbReviewRow = {
    ...reviewRow,
    review_translations: [
      {
        lang: translation.lang,
        slug: translation.slug,
        title: translation.title,
        excerpt: translation.excerpt ?? null,
        content_html: translation.content_html ?? null,
        meta_title: translation.meta_title ?? null,
        meta_description: translation.meta_description ?? null,
      },
      ...translationList
        .filter((item) => item.lang !== translation.lang)
        .map((item) => ({
          lang: item.lang,
          slug: item.slug,
          title: "",
        })),
    ],
  };

  return mapReviewRow(mergedReview, {
    lang: translation.lang,
    includeTranslations: true,
  });
}

export async function fetchReviewMetaById(
  env: ParsedEnv,
  id: string
): Promise<{
  slug: string;
  categoryId: number | null;
  productId?: string | null;
  productSlug?: string | null;
  productTranslations?: { lang: string; slug: string }[];
  status: string;
  authorUsername?: string | null;
  translations?: { lang: string; slug: string }[];
} | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "slug, category_id, status, product_id, profiles(username), review_translations(lang, slug), products(slug, product_translations(lang, slug))"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const translations = Array.isArray(data.review_translations)
    ? data.review_translations.filter(
        (item): item is { lang: string; slug: string } =>
          Boolean(item) && isSupportedLanguage(item.lang)
      )
    : [];
  const defaultTranslation = translations.find(
    (translation) => translation.lang === DEFAULT_LANGUAGE
  );
  const productRelation = Array.isArray(data.products)
    ? data.products[0]
    : data.products;
  const productTranslations = Array.isArray(productRelation?.product_translations)
    ? productRelation.product_translations.filter(
        (item: { lang?: string; slug?: string }): item is {
          lang: string;
          slug: string;
        } => Boolean(item?.lang && item?.slug && isSupportedLanguage(item.lang))
      )
    : [];
  const defaultProductTranslation = productTranslations.find(
    (translation) => translation.lang === DEFAULT_LANGUAGE
  );

  return {
    slug: defaultTranslation?.slug ?? data.slug,
    categoryId: data.category_id ?? null,
    productId: data.product_id ?? null,
    productSlug: defaultProductTranslation?.slug ?? productRelation?.slug ?? null,
    productTranslations: productTranslations.length > 0 ? productTranslations : undefined,
    status: data.status ?? "published",
    authorUsername: Array.isArray(data.profiles)
      ? data.profiles[0]?.username ?? null
      : data.profiles?.username ?? null,
    translations: translations.length > 0 ? translations : undefined,
  };
}

export async function fetchCommentStatusById(
  env: ParsedEnv,
  id: string
): Promise<{
  id: string;
  reviewId: string;
  status: string;
} | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("comments")
    .select("id, review_id, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    reviewId: data.review_id,
    status: data.status ?? "published",
  };
}

export async function fetchReviewComments(
  env: ParsedEnv,
  reviewId: string,
  cursor: string | null,
  limit: number
): Promise<CursorResult<Comment>> {
  const supabase = getSupabaseClient(env);
  let query = supabase
    .from("comments")
    .select("id, review_id, text, created_at, profiles(username, profile_pic_url)")
    .eq("review_id", reviewId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const items = (data ?? []).map(mapCommentRow);
  const nextCursor = items.length > 0 ? items[items.length - 1].createdAt : null;

  return { items, nextCursor };
}

export async function createReview(
  env: ParsedEnv,
  payload: CreateReviewPayload
): Promise<{ id: string; slug: string }> {
  const supabase = getSupabaseClient(env);
  const baseSlug = slugify(payload.title) || `review-${Date.now()}`;
  const slug = await ensureUniqueSlug(env, baseSlug);
  let productId = payload.productId ?? null;
  let isNewProduct = false;

  if (!productId && payload.productName) {
    const match = await findOrCreateProduct(env, {
      name: payload.productName,
      lang: payload.lang,
      status: "published",
      categoryIds: [
        payload.categoryId,
        ...(payload.subCategoryId ? [payload.subCategoryId] : []),
      ],
    });
    productId = match?.productId ?? null;
    isNewProduct = match?.isNew ?? false;
  }

  if (!productId) {
    throw new Error("Product selection is required.");
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      slug,
      title: payload.title,
      excerpt: payload.excerpt,
      content_html: payload.contentHtml,
      rating_avg: payload.rating,
      rating_count: 1,
      votes_up: 0,
      votes_down: 0,
      recommend: payload.recommend ?? null,
      pros: payload.pros ?? null,
      cons: payload.cons ?? null,
      photo_urls: payload.photoUrls,
      photo_count: payload.photoUrls.length,
      category_id: payload.categoryId,
      sub_category_id: payload.subCategoryId ?? null,
      product_id: productId,
      user_id: payload.userId,
      source: "user",
      status: "pending",
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    throw error;
  }

  const { error: translationError } = await supabase
    .from("review_translations")
    .insert({
      review_id: data.id,
      lang: payload.lang,
      slug,
      title: payload.title,
      excerpt: payload.excerpt,
      content_html: payload.contentHtml,
    });

  if (translationError) {
    throw translationError;
  }

  const categoryIds = [
    payload.categoryId,
    ...(payload.subCategoryId ? [payload.subCategoryId] : []),
  ];
  if (categoryIds.length > 0) {
    const { error: categoryError } = await supabase
      .from("product_categories")
      .upsert(
        categoryIds.map((categoryId) => ({
          product_id: productId,
          category_id: categoryId,
        })),
        { onConflict: "product_id,category_id" }
      );
    if (categoryError) {
      throw categoryError;
    }
  }

  if (payload.productPhotoUrl) {
    if (isNewProduct) {
      await attachProductImage(env, {
        productId,
        url: payload.productPhotoUrl,
        sortOrder: 0,
        userId: payload.userId,
      });
    } else {
      const { data: existingImages, error: imageError } = await supabase
        .from("product_images")
        .select("id")
        .eq("product_id", productId)
        .limit(1);

      if (imageError) {
        throw imageError;
      }

      if (!existingImages || existingImages.length === 0) {
        await attachProductImage(env, {
          productId,
          url: payload.productPhotoUrl,
          sortOrder: 0,
          userId: payload.userId,
        });
      }
    }
  }

  return data;
}

export async function addComment(
  env: ParsedEnv,
  payload: { reviewId: string; userId: string; text: string }
): Promise<Comment> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("comments")
    .insert({
      review_id: payload.reviewId,
      user_id: payload.userId,
      text: payload.text,
    })
    .select("id, review_id, text, created_at, profiles(username, profile_pic_url)")
    .single();

  if (error || !data) {
    throw error;
  }

  return mapCommentRow(data as {
    id: string;
    review_id: string;
    text: string;
    created_at: string;
    profiles?:
    | { username: string | null; profile_pic_url: string | null }
    | { username: string | null; profile_pic_url: string | null }[]
    | null;
  });
}

export async function addVote(
  env: ParsedEnv,
  payload: {
    reviewId: string;
    userId?: string | null;
    ipHash?: string | null;
    type: "up" | "down";
  }
): Promise<{ votesUp: number; votesDown: number }> {
  const supabase = getSupabaseClient(env);
  const { error: voteError } = await supabase.from("review_votes").insert({
    review_id: payload.reviewId,
    user_id: payload.userId ?? null,
    ip_hash: payload.ipHash ?? null,
    type: payload.type,
  });

  if (voteError) {
    throw voteError;
  }

  const { data: reviewData, error: reviewError } = await supabase
    .from("reviews")
    .select("votes_up, votes_down")
    .eq("id", payload.reviewId)
    .single();

  if (reviewError || !reviewData) {
    throw reviewError;
  }

  const votesUp = (reviewData.votes_up ?? 0) + (payload.type === "up" ? 1 : 0);
  const votesDown =
    (reviewData.votes_down ?? 0) + (payload.type === "down" ? 1 : 0);

  const { error: updateError } = await supabase
    .from("reviews")
    .update({ votes_up: votesUp, votes_down: votesDown })
    .eq("id", payload.reviewId);

  if (updateError) {
    throw updateError;
  }

  return { votesUp, votesDown };
}

export async function incrementReviewViews(
  env: ParsedEnv,
  reviewId: string
): Promise<{ views: number } | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase.rpc("increment_review_view", {
    review_id: reviewId,
  });

  if (error) {
    throw error;
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const rawViews = data[0]?.views ?? 0;
  const views = typeof rawViews === "number" ? rawViews : Number(rawViews);
  return { views: Number.isFinite(views) ? views : 0 };
}

export async function fetchReviewsByUserComments(
  env: ParsedEnv,
  userId: string,
  page: number,
  pageSize: number,
  lang: SupportedLanguage
): Promise<ReviewListResult> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase.rpc("get_user_commented_reviews", {
    target_user_id: userId,
    page,
    page_size: pageSize,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ReviewWithCountRow[];
  const reviewIds = rows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const translations = await fetchReviewTranslationMap(
    env,
    reviewIds,
    lang
  );
  const items = rows.map((row) =>
    mapReviewRow(attachTranslation(row as DbReviewRow, translations.get(row.id)), {
      lang,
    })
  );
  const totalItems = normalizeTotalCount(rows[0]?.total_count);

  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, totalItems),
  };
}

export async function fetchSavedReviews(
  env: ParsedEnv,
  userId: string,
  page: number,
  pageSize: number,
  lang: SupportedLanguage
): Promise<ReviewListResult> {
  const supabase = getSupabaseClient(env);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("saved_reviews")
    .select(
      `review_id, reviews(${reviewListSelect})`,
      { count: "exact" }
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const rows = (data ?? [])
    .map((row) => (row as { reviews: DbReviewRow | null }).reviews)
    .filter((review): review is DbReviewRow => Boolean(review));
  const translations = await fetchReviewTranslationMap(
    env,
    rows.map((review) => review.id),
    lang
  );
  const items = rows.map((review) =>
    mapReviewRow(attachTranslation(review, translations.get(review.id)), { lang })
  );

  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function fetchReviewsByUserId(
  env: ParsedEnv,
  userId: string,
  page: number,
  pageSize: number,
  lang: SupportedLanguage,
  statuses: ReviewStatus[] = ["published"]
): Promise<ReviewListResult> {
  const supabase = getSupabaseClient(env);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("reviews")
    .select(reviewListSelectWithTranslations, { count: "exact" })
    .eq("user_id", userId)
    .eq("review_translations.lang", lang)
    .order("created_at", { ascending: false });

  if (statuses.length > 0) {
    query = query.in("status", statuses);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: (data ?? []).map((row) => mapReviewRow(row as DbReviewRow, { lang })),
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

type DbReviewTranslationLookupRow = DbReviewTranslationRow & {
  review_id: string;
};

async function fetchReviewTranslationMap(
  env: ParsedEnv,
  reviewIds: string[],
  lang: SupportedLanguage
): Promise<Map<string, DbReviewTranslationRow>> {
  if (reviewIds.length === 0) {
    return new Map();
  }

  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("review_translations")
    .select(
      "review_id, lang, slug, title, excerpt, content_html, meta_title, meta_description"
    )
    .in("review_id", reviewIds)
    .eq("lang", lang);

  if (error) {
    throw error;
  }

  const map = new Map<string, DbReviewTranslationRow>();
  (data ?? []).forEach((row) => {
    const translation = row as DbReviewTranslationLookupRow;
    map.set(translation.review_id, {
      lang: translation.lang,
      slug: translation.slug,
      title: translation.title,
      excerpt: translation.excerpt ?? null,
      content_html: translation.content_html ?? null,
      meta_title: translation.meta_title ?? null,
      meta_description: translation.meta_description ?? null,
    });
  });

  return map;
}

function attachTranslation(
  review: DbReviewRow,
  translation?: DbReviewTranslationRow
): DbReviewRow {
  if (!translation) {
    return review;
  }

  return {
    ...review,
    review_translations: [translation],
  };
}

function buildHiddenReview(row: {
  id: string;
  slug: string;
  created_at: string;
  translationLang?: string;
  profiles?:
    | { username: string | null; profile_pic_url: string | null }
    | { username: string | null; profile_pic_url: string | null }[]
    | null;
}): Review {
  const profile = Array.isArray(row.profiles)
    ? row.profiles[0] ?? null
    : row.profiles ?? null;
  return {
    id: row.id,
    translationLang: row.translationLang,
    slug: row.slug,
    title: HIDDEN_REVIEW_TITLE,
    excerpt: HIDDEN_REVIEW_EXCERPT,
    contentHtml: `<p>${HIDDEN_REVIEW_EXCERPT}</p>`,
    ratingAvg: undefined,
    ratingCount: undefined,
    views: undefined,
    votesUp: undefined,
    votesDown: undefined,
    photoUrls: [],
    photoCount: 0,
    commentCount: undefined,
    author: {
      username: profile?.username ?? "unknown",
      displayName: profile?.username ?? undefined,
      profilePicUrl: profile?.profile_pic_url ?? undefined,
    },
    createdAt: row.created_at,
  };
}

function normalizeTotalCount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function ensureUniqueSlug(
  env: ParsedEnv,
  baseSlug: string
): Promise<string> {
  const supabase = getSupabaseClient(env);
  let candidate = baseSlug;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition -- intentional loop until slug is unique
  while (true) {
    const { data: translation, error: translationError } = await supabase
      .from("review_translations")
      .select("review_id")
      .eq("slug", candidate)
      .maybeSingle();

    if (translationError) {
      throw translationError;
    }

    if (!translation) {
      const { data: review, error: reviewError } = await supabase
        .from("reviews")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();

      if (reviewError) {
        throw reviewError;
      }

      if (!review) {
        return candidate;
      }
    }

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}
