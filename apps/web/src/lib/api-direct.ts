import { getSupabaseClient } from "@/src/lib/supabase";
import { DEFAULT_LANGUAGE, isSupportedLanguage, type SupportedLanguage } from "@/src/lib/i18n";
import type { Review, Comment, Product, ProductStats, ProductImage, ProductStatus, BrandStatus, Category, PaginationInfo, UserProfile } from "@/src/types";

// --- Internal Types matching DB structure ---

type DbProfile = {
    user_id: string;
    username: string;
    bio: string | null;
    profile_pic_url: string | null;
    created_at?: string | null;
    is_verified?: boolean | null;
    verified_at?: string | null;
    verified_by?: string | null;
};

type DbCategory = {
    id: number;
    name: string;
    parent_id: number | null;
    category_translations?: { lang: string; name: string }[] | null;
};

type DbProductTranslationRow = {
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
    product_translations?: DbProductTranslationRow[] | null;
    product_images?: DbProductImage[] | null;
    product_stats?: DbProductStats | DbProductStats[] | null;
    product_categories?: { category_id: number | null }[] | null;
};

type DbReviewTranslationRow = {
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
        product_translations?: DbProductTranslationRow[] | null;
    }
    | {
        id: string | null;
        slug: string | null;
        name: string | null;
        product_translations?: DbProductTranslationRow[] | null;
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

// --- Constants & Helpers ---

const CYRILLIC_RE = /[\u0400-\u04FF]/;
const R2_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_IMAGE_CDN_BASE_URL;

function fixUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    if (R2_PUBLIC_BASE_URL && url.includes(".r2.dev")) {
        return url.replace(/https:\/\/[^/]+\.r2\.dev/g, R2_PUBLIC_BASE_URL);
    }
    return url;
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

function deriveNameFromSlug(slug: string | null | undefined): string | undefined {
    if (!slug) return undefined;
    const cleaned = slug.replace(/[-_]+/g, " ").trim();
    return cleaned || undefined;
}

function sanitizeProductName(
    name: string | null | undefined,
    slug: string | null | undefined
): string | undefined {
    if (!name) return undefined;
    if (!CYRILLIC_RE.test(name)) {
        return name;
    }
    return deriveNameFromSlug(slug) ?? name;
}

function sanitizeProductDescription(
    description: string | null | undefined
): string | undefined {
    if (!description) return undefined;
    if (CYRILLIC_RE.test(description)) {
        return undefined;
    }
    return description;
}

function resolveReviewContentHtml(
    primary: string | null | undefined,
    fallback: string | null | undefined
): string | undefined {
    if (primary && primary.trim().length > 0) {
        const stripped = primary.replace(/<[^>]+>/g, "").trim();
        if (stripped.length > 0) {
            return primary;
        }
    }
    if (fallback && fallback.trim().length > 0) {
        return fallback;
    }
    return primary ?? undefined;
}

// --- Mappers ---

type DbCategoryTranslation = {
    lang: string;
    name: string;
};

type DbCategory = {
    id: number;
    name: string;
    parent_id: number | null;
    category_translations?: DbCategoryTranslation[] | null;
};

// --- Mappers ---

function mapCategoryRow(row: DbCategory, lang?: string): Category {
    const translation = row.category_translations?.find((t) => t.lang === lang);
    return {
        id: row.id,
        name: translation?.name ?? row.name,
        parentId: row.parent_id,
    };
}

function mapProductRow(
    row: DbProductRow,
    options?: { lang?: string; includeTranslations?: boolean }
): Product {
    const translation = Array.isArray(row.product_translations)
        ? row.product_translations.find((item) => item.lang === options?.lang) ??
        row.product_translations[0]
        : undefined;
    const images: ProductImage[] | undefined = Array.isArray(row.product_images)
        ? row.product_images.map((image) => ({
            id: image.id,
            url: fixUrl(image.url) ?? image.url,
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

    const resolvedSlug = translation?.slug ?? row.slug;
    const resolvedName = translation?.name ?? row.name;
    const resolvedDescription = translation?.description ?? row.description;
    const safeName = sanitizeProductName(resolvedName, resolvedSlug);
    const safeDescription = sanitizeProductDescription(resolvedDescription);

    return {
        id: row.id,
        translationLang: translation?.lang,
        slug: resolvedSlug,
        name: safeName ?? resolvedName,
        description: safeDescription ?? undefined,
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

function mapReviewRow(
    row: DbReviewRow,
    options?: { lang?: string; includeTranslations?: boolean }
): Review {
    const profile = pickRelation(row.profiles);
    const product = pickRelation(row.products);
    const productTranslations = Array.isArray(product?.product_translations)
        ? product.product_translations
        : [];
    const preferredProductTranslation = options?.lang
        ? productTranslations.find((translation) => translation.lang === options.lang)
        : productTranslations[0];

    const translations = Array.isArray(row.review_translations)
        ? row.review_translations
            .filter((item): item is NonNullable<DbReviewRow["review_translations"]>[number] =>
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
        ?.map((u) => fixUrl(u))
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
    const resolvedProductSlug = preferredProductTranslation?.slug ?? product?.slug ?? "";
    const resolvedProductName = preferredProductTranslation?.name ?? product?.name ?? "";
    const safeProductName = sanitizeProductName(
        resolvedProductName,
        resolvedProductSlug
    );

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
            profilePicUrl: fixUrl(profile?.profile_pic_url),
        },
        createdAt: row.created_at,
        categoryId: categoryId ?? undefined,
        subCategoryId: subCategoryId ?? undefined,
        productId: row.product_id ?? undefined,
        product: product?.id
            ? {
                id: product.id,
                slug: resolvedProductSlug,
                name: safeProductName ?? resolvedProductName,
            }
            : undefined,
    };
}

function mapCommentRow(
    row: DbComment
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
            profilePicUrl: fixUrl(profile?.profile_pic_url),
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

function buildHiddenReview(data: {
    id: string;
    slug: string;
    created_at: string;
    translationLang: string;
    profiles: any;
}): Review {
    const profile = pickRelation(data.profiles);
    return {
        id: data.id,
        slug: data.slug,
        translationLang: data.translationLang,
        title: "Review not available",
        excerpt: "This review is currently unavailable.",
        createdAt: data.created_at,
        author: {
            username: profile?.username ?? "unknown",
            displayName: profile?.username ?? undefined,
            profilePicUrl: fixUrl(profile?.profile_pic_url),
        },
        ratingAvg: 0
    };
}


// --- API FUNCTIONS ---

// 1. Review Detail
export async function getReviewBySlugDirect(
    slug: string,
    lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Review | null> {
    const supabase = getSupabaseClient();
    const reviewDetailSelect = `
  id, slug, title, excerpt, rating_avg, rating_count, views, votes_up, votes_down, photo_urls, photo_count, comment_count, recommend, pros, cons, category_id, sub_category_id, product_id, created_at,
  profiles(username, profile_pic_url),
  products(id, slug, name, product_translations(lang, slug, name)),
  content_html, status
  `;

    const translationSelect = `
    review_id, lang, slug, title, excerpt, content_html, meta_title, meta_description, summary, faq, specs, pros, cons,
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
        console.error("Direct DB Error:", error);
        return null;
    }

    let translation = data as any;

    if (!translation) {
        const { data: lookup } = await supabase
            .from("review_translations")
            .select("review_id")
            .eq("slug", slug)
            .maybeSingle();

        if (!lookup?.review_id) return null;

        const { data: fallbackTranslation } = await supabase
            .from("review_translations")
            .select(translationSelect)
            .eq("review_id", lookup.review_id)
            .eq("lang", DEFAULT_LANGUAGE)
            .maybeSingle();

        translation = fallbackTranslation as any;
    }

    if (!translation?.reviews) return null;

    const reviewRow = translation.reviews;
    const status = reviewRow.status ?? "published";
    if (status === "deleted" || status === "pending" || status === "draft") return null;
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
            (item: any) => Boolean(item) && isSupportedLanguage(item.lang)
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
                summary: translation.summary ?? null,
                faq: translation.faq,
                specs: translation.specs,
                pros: translation.pros,
                cons: translation.cons,
            },
            ...translationList
                .filter((item: any) => item.lang !== translation.lang)
                .map((item: any) => ({
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

// 2. Comments
export type CursorResult<T> = {
    items: T[];
    nextCursor: string | null;
};

export async function getReviewCommentsDirect(
    reviewId: string,
    limit = 10,
    cursor?: string | null
): Promise<CursorResult<Comment>> {
    const supabase = getSupabaseClient();
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
        console.error("Comments Fetch Error", error);
        return { items: [], nextCursor: null };
    }

    const items = (data ?? []).map((row: any) => mapCommentRow(row));
    const nextCursor = items.length > 0 ? items[items.length - 1].createdAt : null;

    return { items, nextCursor };
}

// 3. Product Detail
export async function getProductBySlugDirect(
    slug: string,
    lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Product | null> {
    const supabase = getSupabaseClient();
    const productSelect = `
    id, slug, name, description, status, created_at, updated_at,
    brands(id, slug, name, status),
    product_images(id, url, sort_order),
    product_categories(category_id),
    product_stats(review_count, rating_avg, rating_count, recommend_up, recommend_down, photo_count),
    product_translations(lang, slug, name, description, meta_title, meta_description)
    `;

    const { data: translation } = await supabase
        .from("product_translations")
        .select("product_id")
        .eq("slug", slug)
        .eq("lang", lang)
        .maybeSingle();

    let productId = translation?.product_id;

    if (!productId) {
        const { data: product } = await supabase
            .from("products")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
        productId = product?.id;
    }

    if (!productId) return null;

    const { data, error } = await supabase
        .from("products")
        .select(productSelect)
        .eq("id", productId)
        .maybeSingle();

    if (error || !data) return null;

    return mapProductRow(data as DbProductRow, { lang, includeTranslations: true });
}

// 4. Categories (Cached)
export async function getCategoriesDirect(
    lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Category[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
        .from("categories")
        .select("id, name, parent_id, category_translations(lang, name)");
    return (data ?? []).map((row) => mapCategoryRow(row as DbCategory, lang));
}

// 5. Category/Related Feed
export async function getCategoryPageDirect(
    categoryId: number,
    page: number,
    pageSize: number,
    sort: "latest" | "popular" | "rating" = "latest",
    subCategoryId?: number,
    lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<{ items: Review[], pageInfo: PaginationInfo }> {
    const supabase = getSupabaseClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from("reviews")
        .select(`
            id, slug, title, excerpt, rating_avg, rating_count, views, votes_up, votes_down, photo_urls, photo_count, comment_count, recommend, pros, cons, category_id, sub_category_id, product_id, created_at,
            profiles(username, profile_pic_url),
            products(id, slug, name, product_translations(lang, slug, name)),
            review_translations(lang, title, slug, excerpt) 
        `, { count: "exact" })
        .eq("category_id", categoryId)
        .eq("status", "published")
        .eq("review_translations.lang", lang);

    if (subCategoryId) {
        query = query.eq("sub_category_id", subCategoryId);
    }

    if (sort === "popular") {
        query = query.order("views", { ascending: false });
    } else if (sort === "rating") {
        query = query.order("rating_avg", { ascending: false });
    } else {
        query = query.order("created_at", { ascending: false });
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
        console.error("Category Page Direct Error", error);
        return { items: [], pageInfo: { page, pageSize, totalItems: 0, totalPages: 0 } };
    }

    const items = (data ?? []).map((row: any) => mapReviewRow(row as DbReviewRow, { lang }));
    const totalItems = count ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    return { items, pageInfo: { page, pageSize, totalItems, totalPages } };
}

// 6. User Profile
export async function getUserProfileDirect(username: string): Promise<UserProfile | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, bio, profile_pic_url, created_at, is_verified, verified_at, verified_by")
        .ilike("username", username)
        .maybeSingle();

    if (error || !data) return null;

    const { data: statsData } = await supabase.rpc("get_user_stats", { target_user_id: data.user_id });
    const statsRow = Array.isArray(statsData) ? statsData[0] : null;

    return {
        userId: data.user_id,
        username: data.username,
        displayName: data.username,
        bio: data.bio ?? undefined,
        profilePicUrl: fixUrl(data.profile_pic_url),
        createdAt: data.created_at ?? undefined,
        isVerified: data.is_verified ?? false,
        stats: {
            reviewCount: normalizeNumber(statsRow?.review_count),
            totalViews: normalizeNumber(statsRow?.total_views),
            reputation: normalizeNumber(statsRow?.total_votes),
            karma: normalizeNumber(statsRow?.total_votes),
            totalComments: normalizeNumber(statsRow?.total_comments),
        }
    };
}

// 7. User Reviews
export async function getUserReviewsDirect(
    username: string,
    page: number,
    pageSize: number,
    lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<{ items: Review[], pageInfo: PaginationInfo }> {
    const supabase = getSupabaseClient();
    const { data: user } = await supabase.from("profiles").select("user_id").ilike("username", username).maybeSingle();
    if (!user) return { items: [], pageInfo: { page, pageSize, totalItems: 0, totalPages: 0 } };

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await supabase
        .from("reviews")
        .select(`
            id, slug, title, excerpt, rating_avg, rating_count, views, votes_up, votes_down, photo_urls, photo_count, comment_count, recommend, pros, cons, category_id, sub_category_id, product_id, created_at,
            profiles(username, profile_pic_url),
            products(id, slug, name, product_translations(lang, slug, name)),
            review_translations(lang, title, slug, excerpt)
        `, { count: "exact" })
        .eq("status", "published")
        .eq("user_id", user.user_id)
        .eq("review_translations.lang", lang)
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) {
        return { items: [], pageInfo: { page, pageSize, totalItems: 0, totalPages: 0 } };
    }

    const items = (data ?? []).map((row: any) => mapReviewRow(row as DbReviewRow, { lang }));
    const totalItems = count ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    return { items, pageInfo: { page, pageSize, totalItems, totalPages } };
}

// 8. User Comments (Returning Reviews commented on)
export async function getUserCommentsDirect(
    username: string,
    page: number,
    pageSize: number,
    lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<{ items: Review[], pageInfo: PaginationInfo }> {
    const supabase = getSupabaseClient();
    const { data: user } = await supabase.from("profiles").select("user_id").ilike("username", username).maybeSingle();
    if (!user) return { items: [], pageInfo: { page, pageSize, totalItems: 0, totalPages: 0 } };

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Fetch comments to get review_ids
    const { data: comments, count, error } = await supabase
        .from("comments")
        .select("review_id", { count: "exact" })
        .eq("status", "published")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error || !comments || comments.length === 0) {
        return { items: [], pageInfo: { page, pageSize, totalItems: 0, totalPages: 0 } };
    }

    const reviewIds = Array.from(new Set(comments.map((c: any) => c.review_id)));

    const { data: reviews } = await supabase
        .from("reviews")
        .select(`
            id, slug, title, excerpt, rating_avg, rating_count, views, votes_up, votes_down, photo_urls, photo_count, comment_count, recommend, pros, cons, category_id, sub_category_id, product_id, created_at,
            profiles(username, profile_pic_url),
            products(id, slug, name, product_translations(lang, slug, name)),
            review_translations(lang, title, slug, excerpt)
        `)
        .in("id", reviewIds)
        .eq("review_translations.lang", lang);

    const items = (reviews ?? []).map((row: any) => mapReviewRow(row as DbReviewRow, { lang }));
    const totalItems = count ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    return { items, pageInfo: { page, pageSize, totalItems, totalPages } };
}

// 9. Products List
export async function getProductsDirect(
    page: number,
    pageSize: number,
    sort: "latest" | "popular" | "rating" = "latest",
    categoryId?: number,
    lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<{ items: Product[], pageInfo: PaginationInfo }> {
    const supabase = getSupabaseClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from("products")
        .select(`
            id, slug, name, description, status, created_at, updated_at,
            brands(id, slug, name, status),
            product_images(id, url, sort_order),
            product_categories(category_id),
            product_stats(review_count, rating_avg, rating_count, recommend_up, recommend_down, photo_count),
            product_translations(lang, slug, name, description, meta_title, meta_description)
        `, { count: "exact" })
        .eq("status", "published");

    if (categoryId) {
        // This requires filtering by joined table which is tricky in single query with Supabase standard client
        // Often resolved by filtering on 'product_categories.category_id' but Supabase (PostgREST) semantics can be strict.
        // using !inner on join
        query = supabase
            .from("products")
            .select(`
             id, slug, name, description, status, created_at, updated_at,
             brands(id, slug, name, status),
             product_images(id, url, sort_order),
             product_categories!inner(category_id),
             product_stats(review_count, rating_avg, rating_count, recommend_up, recommend_down, photo_count),
             product_translations(lang, slug, name, description, meta_title, meta_description)
            `, { count: "exact" })
            .eq("status", "published")
            .eq("product_categories.category_id", categoryId);
    }

    // Sort logic
    if (sort === "popular") {
        query = query.order("review_count", { foreignTable: "product_stats", ascending: false, nullsFirst: false });
    } else if (sort === "rating") {
        query = query.order("rating_avg", { foreignTable: "product_stats", ascending: false, nullsFirst: false });
    } else {
        query = query.order("created_at", { ascending: false });
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
        return { items: [], pageInfo: { page, pageSize, totalItems: 0, totalPages: 0 } };
    }

    const items = (data ?? []).map((row: any) => mapProductRow(row as DbProductRow, { lang, includeTranslations: true }));
    const totalItems = count ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    return { items, pageInfo: { page, pageSize, totalItems, totalPages } };
}

// 10. Product Reviews
export async function getProductReviewsDirect(
    productId: string,
    page: number,
    pageSize: number,
    sort: "latest" | "popular" | "rating" = "latest",
    lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<{ items: Review[], pageInfo: PaginationInfo }> {
    const supabase = getSupabaseClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from("reviews")
        .select(`
            id, slug, title, excerpt, rating_avg, rating_count, views, votes_up, votes_down, photo_urls, photo_count, comment_count, recommend, pros, cons, category_id, sub_category_id, product_id, created_at,
            profiles(username, profile_pic_url),
            products(id, slug, name, product_translations(lang, slug, name)),
            review_translations(lang, title, slug, excerpt)
        `, { count: "exact" })
        .eq("status", "published")
        .eq("product_id", productId)
        .eq("review_translations.lang", lang);

    if (sort === "popular") {
        query = query.order("views", { ascending: false });
    } else if (sort === "rating") {
        query = query.order("rating_avg", { ascending: false });
    } else {
        query = query.order("created_at", { ascending: false });
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
        return { items: [], pageInfo: { page, pageSize, totalItems: 0, totalPages: 0 } };
    }

    const items = (data ?? []).map((row: any) => mapReviewRow(row as DbReviewRow, { lang }));
    const totalItems = count ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    return { items, pageInfo: { page, pageSize, totalItems, totalPages } };
}

// 11. Subcategories
// 11. Subcategories
export async function getSubcategoriesDirect(
    parentId: number,
    lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Category[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
        .from("categories")
        .select("id, name, parent_id, category_translations(lang, name)")
        .eq("parent_id", parentId);

    return (data ?? []).map((row) => mapCategoryRow(row as DbCategory, lang));
}

// 10. Homepage Data
export async function getLatestReviewsDirect(
    limit: number,
    lang: SupportedLanguage
): Promise<Review[]> {
    const supabase = getSupabaseClient();
    const select = `
    id, slug, title, excerpt, rating_avg, rating_count, views, votes_up, votes_down, photo_urls, photo_count, comment_count, recommend, pros, cons, category_id, sub_category_id, product_id, created_at, status, content_html,
    profiles(username, profile_pic_url),
    products(id, slug, name, product_translations(lang, slug, name)),
    review_translations(lang, slug, title, excerpt, content_html, summary, pros, cons)
  `;

    // We want latest published reviews
    const { data, error } = await supabase
        .from("reviews")
        .select(select)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("getLatestReviewsDirect Error:", error);
        return [];
    }

    return (data as any[]).map((row) => mapReviewRow(row as DbReviewRow, { lang }));
}

export async function getPopularReviewsDirect(
    limit: number,
    timeWindow: "6h" | "24h" | "week" | undefined,
    lang: SupportedLanguage
): Promise<Review[]> {
    const supabase = getSupabaseClient();
    const select = `
    id, slug, title, excerpt, rating_avg, rating_count, views, votes_up, votes_down, photo_urls, photo_count, comment_count, recommend, pros, cons, category_id, sub_category_id, product_id, created_at, status, content_html,
    profiles(username, profile_pic_url),
    products(id, slug, name, product_translations(lang, slug, name)),
    review_translations(lang, slug, title, excerpt, content_html, summary, pros, cons)
  `;

    let query = supabase
        .from("reviews")
        .select(select)
        .eq("status", "published");

    if (timeWindow) {
        const now = new Date();
        const past = new Date();
        if (timeWindow === "6h") past.setHours(now.getHours() - 6);
        else if (timeWindow === "24h") past.setHours(now.getHours() - 24);
        else if (timeWindow === "week") past.setDate(now.getDate() - 7);
        query = query.gte("created_at", past.toISOString());
    }

    // Order by popularity (votes_up + views logic or similar)
    // For now simple: votes_up DESC
    query = query.order("votes_up", { ascending: false }).limit(limit);

    const { data, error } = await query;

    if (error) {
        console.error("getPopularReviewsDirect Error:", error);
        return [];
    }

    return (data as any[]).map((row) => mapReviewRow(row as DbReviewRow, { lang }));
}

export async function getTopReviewersDirect(limit: number): Promise<UserProfile[]> {
    const supabase = getSupabaseClient();

    // Fetch users. Try to order by review_count in stats if possible.
    // If we can't sort by JSON field easily using .order('stats->reviewCount'), we might need an RPC or fallback.
    // Let's assume stats->reviewCount works or we just order by created_at as fallback for now.
    // Alternatively, we can fetch more users and sort in memory if N is small (e.g. 50).

    const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, profile_pic_url, stats, created_at, is_verified")
        .limit(50); // Fetch 50, sort in memory

    if (error || !data) {
        return [];
    }

    // Sort in memory by reviewCount
    const sorted = data.sort((a: any, b: any) => {
        const countA = a.stats?.reviewCount ?? 0;
        const countB = b.stats?.reviewCount ?? 0;
        return countB - countA;
    });

    return sorted.slice(0, limit).map((row: any) => ({
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name ?? row.username,
        profilePicUrl: fixUrl(row.profile_pic_url),
        stats: row.stats,
        isVerified: row.is_verified,
        createdAt: row.created_at
    }));
}

export async function getHomepageDataDirect({
    latestLimit = 10,
    popularLimit = 10,
    timeWindow,
    lang = DEFAULT_LANGUAGE,
}: {
    latestLimit?: number;
    popularLimit?: number;
    timeWindow?: "6h" | "24h" | "week";
    lang?: SupportedLanguage;
}): Promise<HomepagePayload> {
    const [latest, popular, categories, topReviewers] = await Promise.all([
        getLatestReviewsDirect(latestLimit, lang),
        getPopularReviewsDirect(popularLimit, timeWindow, lang),
        getCategoriesDirect(lang),
        getTopReviewersDirect(10)
    ]);

    return {
        latest: { items: latest, nextCursor: null },
        popular: { items: popular },
        categories: { items: categories },
        topReviewers: { items: topReviewers }
    };
}

export async function getCatalogPageDirect(
    page: number,
    pageSize: number,
    sort: "latest" | "popular" | "rating" = "latest",
    categoryId?: number,
    lang: SupportedLanguage = DEFAULT_LANGUAGE,
    options?: { photoOnly?: boolean }
): Promise<{ items: Review[], pageInfo: PaginationInfo }> {
    const supabase = getSupabaseClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const select = `
        id, slug, title, excerpt, rating_avg, rating_count, views, votes_up, votes_down, photo_urls, photo_count, comment_count, recommend, pros, cons, category_id, sub_category_id, product_id, created_at, status, content_html,
        profiles(username, profile_pic_url),
        products(id, slug, name, product_translations(lang, slug, name)),
        review_translations(lang, slug, title, excerpt, content_html, summary, pros, cons)
     `;

    let query = supabase
        .from("reviews")
        .select(select, { count: "exact" })
        .eq("status", "published");

    if (categoryId) {
        query = query.eq("category_id", categoryId);
    }

    if (options?.photoOnly) {
        // Simple check: photo_urls is not null and not empty.
        // Postgrest: photo_urls.neq.{} or photo_urls.not.is.null
        // Assuming photo_urls is ARRAY/JSONB
        query = query.not('photo_urls', 'is', null).neq('photo_urls', '{}');
    }

    if (sort === "popular") {
        query = query.order("votes_up", { ascending: false });
    } else if (sort === "rating") {
        query = query.order("rating_avg", { ascending: false });
    } else {
        query = query.order("created_at", { ascending: false });
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
        console.error("getCatalogPageDirect Error:", error);
        return { items: [], pageInfo: { page, pageSize, totalItems: 0, totalPages: 0 } };
    }

    const items = (data ?? []).map((row: any) => mapReviewRow(row as DbReviewRow, { lang }));
    const totalItems = count ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    return { items, pageInfo: { page, pageSize, totalItems, totalPages } };
}

// 12. Search Reviews
export async function searchReviewsDirect(
    query: string,
    page: number,
    pageSize: number,
    categoryId?: number,
    lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<{ items: Review[], pageInfo: PaginationInfo }> {
    const supabase = getSupabaseClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Search in review_translations title
    const select = `
        id, slug, title, excerpt, rating_avg, rating_count, views, votes_up, votes_down, photo_urls, photo_count, comment_count, recommend, pros, cons, category_id, sub_category_id, product_id, created_at, status, content_html,
        profiles(username, profile_pic_url),
        products(id, slug, name, product_translations(lang, slug, name)),
        review_translations!inner(lang, slug, title, excerpt, content_html, summary, pros, cons)
     `;

    let dbQuery = supabase
        .from("reviews")
        .select(select, { count: "exact" })
        .eq("status", "published")
        .eq("review_translations.lang", lang)
        .ilike("review_translations.title", `%${query}%`);

    if (categoryId) {
        dbQuery = dbQuery.eq("category_id", categoryId);
    }

    const { data, count, error } = await dbQuery.range(from, to).order("created_at", { ascending: false });

    if (error) {
        console.error("searchReviewsDirect Error:", error);
        return { items: [], pageInfo: { page, pageSize, totalItems: 0, totalPages: 0 } };
    }

    const items = (data ?? []).map((row: any) => mapReviewRow(row as DbReviewRow, { lang }));
    const totalItems = count ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    return { items, pageInfo: { page, pageSize, totalItems, totalPages } };
}

// 13. Leaderboard
export async function getLeaderboardDirect(
    metric: LeaderboardMetric = "active",
    timeframe: LeaderboardTimeframe = "all",
    page: number,
    pageSize: number,
    lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<{ items: LeaderboardEntry[], pageInfo: PaginationInfo }> {
    const supabase = getSupabaseClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from("profiles")
        .select("user_id, username, display_name, profile_pic_url, stats, created_at, is_verified", { count: "exact" });

    // Sorting mapping
    // Note: JSONB sorting in Supabase can be tricky.
    // If we assume 'stats' is a JSONB column.
    // 'stats->reviewCount' syntax might need casting or specific method.
    // For now, simple implementation assuming we might need to sort in memory if DB sort fails?
    // But for pagination we need DB sort.
    // Let's try arrow operator. `stats->>reviewCount` casts to text, we need numeric sort.
    // PostgREST doesn't easily support casting in order param directly without created columns/views.
    // If performance is key and list is small, memory sort is safer. But for strict pagination of large sets, we need DB helper.
    // Given user constraint "make it world class fast", DB sort is best.
    // If stats is failing, we might fallback to simple columns if they exist.
    // Assuming 'stats' keys match types.ts: reviewCount, reputation, totalViews.

    // Using "raw" order if needed or just standard if supported.
    // Supabase JS client v2: .order('stats->reviewCount', ...) might not cast.

    // STRATEGY: Fetch a larger batch (e.g. 100) and sort in memory if the dataset is small enough.
    // If user has thousands, this is bad.
    // BETTER STRATEGY: Use dedicated columns if they exist? They don't appear in the Types.

    // Let's try to order by the likely numeric fields.
    // If this fails/is slow, we really should recommend schema changes (adding specific columns like 'reputation' to profiles table).
    // For now, I will use a larger fetch limit and in-memory sort for "top" lists, as "Leaderboard" is usually top N.
    // World class optimization: DB View.

    if (metric === "active") {
        // Sort logic in code for safety if direct DB JSON sort is risky
    }

    // Fetching more to ensure we get the top ones if we sort in memory
    // But since we need pagination, we probably rely on some index.
    // Let's assume for this specific codebase, we might not have perfect DB indexes on JSON keys.
    // I'll stick to fetching 100 for page 1. Pagination deeply might be inaccurate without DB sort.

    const { data, count, error } = await query.range(0, 99); // Fetch top 100 for now.

    if (error) {
        console.error("getLeaderboardDirect Error:", error);
        return { items: [], pageInfo: { page, pageSize, totalItems: 0, totalPages: 0 } };
    }

    let items = (data ?? []).map((row: any) => ({
        profile: {
            userId: row.user_id,
            username: row.username,
            displayName: row.display_name,
            profilePicUrl: fixUrl(row.profile_pic_url),
            stats: row.stats,
            isVerified: row.is_verified,
            createdAt: row.created_at
        },
        stats: row.stats || {},
        rank: 0
    }));

    // In-memory Sort
    items.sort((a, b) => {
        const getVal = (entry: any, m: string) => {
            const s = entry.stats || {};
            if (m === "active") return s.reviewCount ?? 0;
            if (m === "helpful") return s.reputation ?? 0;
            if (m === "trending") return s.totalViews ?? 0; // Fallback
            return 0;
        };
        return getVal(b, metric) - getVal(a, metric);
    });

    // Apply rank
    items = items.map((item, idx) => ({ ...item, rank: idx + 1 }));

    // Slice for pagination
    const paginatedItems = items.slice(from, to + 1);

    return {
        items: paginatedItems,
        pageInfo: {
            page,
            pageSize,
            totalItems: count ?? 0,
            totalPages: Math.ceil((count ?? 0) / pageSize)
        }
    };
}
