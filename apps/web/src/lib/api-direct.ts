import { getSupabaseClient } from "@/src/lib/supabase";
import { DEFAULT_LANGUAGE, isSupportedLanguage, type SupportedLanguage } from "@/src/lib/i18n";
import type { Review } from "@/src/types";

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

type DbProductTranslation = {
    lang: string;
    slug: string;
    name?: string | null;
    description?: string | null;
    meta_title?: string | null;
    meta_description?: string | null;
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
        product_translations?: DbProductTranslation[] | null;
    }
    | {
        id: string | null;
        slug: string | null;
        name: string | null;
        product_translations?: DbProductTranslation[] | null;
    }[]
    | null;
};

// --- Constants & Helpers ---

const CYRILLIC_RE = /[\u0400-\u04FF]/;
const R2_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_IMAGE_CDN_BASE_URL || "https://media.userreview.net";

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
  products(id, slug, name, product_translations(lang, slug, name))
`;

const reviewDetailSelect = `
  ${reviewListSelect},
  content_html,
  status
`;

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

function resolveReviewContentHtml(
    primary: string | null | undefined,
    fallback: string | null | undefined
): string | undefined {
    if (primary && primary.trim().length > 0) {
        // Simple strip check (incomplete but minimal)
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

function buildHiddenReview(data: {
    id: string;
    slug: string;
    created_at: string;
    translationLang: string;
    profiles: any;
}): Review {
    // Minimal hidden review structure
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


// --- Main Exported Function ---

export async function getReviewBySlugDirect(
    slug: string,
    lang: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<Review | null> {
    const supabase = getSupabaseClient();
    const translationSelect = `
    review_id,
    lang,
    slug,
    title,
    excerpt,
    content_html,
    meta_title,
    meta_description,
    summary,
    faq,
    specs,
    pros,
    cons,
    reviews(
      ${reviewDetailSelect},
      review_translations(lang, slug)
    )
  `;

    // 1. Try to find translation matching slug & lang
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

    let translation = data as
        | (DbReviewTranslationRow & {
            review_id: string;
            reviews: (DbReviewRow & { status?: string }) | null;
        })
        | null;

    // 2. Fallback logic if not found (look up review ID by slug in ANY language)
    if (!translation) {
        const { data: lookup, error: lookupError } = await supabase
            .from("review_translations")
            .select("review_id")
            .eq("slug", slug)
            .maybeSingle();

        if (lookupError) {
            console.error("Direct DB Lookup Error:", lookupError);
            return null;
        }

        if (!lookup?.review_id) {
            return null;
        }

        // Fetch review with default language translation
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

    // Merge the fetched translation into the review row to prioritize it
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
