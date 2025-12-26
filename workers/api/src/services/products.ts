import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import type {
  AdminProduct,
  PaginationInfo,
  Product,
  ProductStatus,
  ProductTranslation,
} from "../types";
import { DEFAULT_LANGUAGE, isSupportedLanguage, type SupportedLanguage } from "../utils/i18n";
import { buildPaginationInfo } from "../utils/pagination";
import { slugify } from "../utils/slug";
import { mapProductRow } from "./mappers";

export type ProductSort = "latest" | "rating" | "popular";

type ProductListResult = {
  items: Product[];
  pageInfo: PaginationInfo;
};

type AdminProductListResult = {
  items: AdminProduct[];
  pageInfo: PaginationInfo;
};

type DbProductTranslationRow = {
  lang: string;
  slug: string;
  name?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
};

type DbProductTranslationLookupRow = DbProductTranslationRow & {
  product_id: string;
};

type DbProductStatsLookupRow = {
  product_id: string;
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
  product_translations?: DbProductTranslationRow[] | null;
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
  product_images?:
  | {
    id: string;
    url: string;
    sort_order?: number | null;
  }[]
  | null;
  product_stats?: DbProductStatsLookupRow | DbProductStatsLookupRow[] | null;
  product_categories?: { category_id: number | null }[] | null;
};

function buildIlikePattern(query?: string): string | null {
  const normalized = query?.trim().replace(/,/g, " ") ?? "";
  if (!normalized) {
    return null;
  }
  const escaped = normalized.replace(/[%_]/g, "\\$&");
  return `%${escaped}%`;
}

const productListSelect = `
  id,
  slug,
  name,
  description,
  status,
  created_at,
  updated_at,
  brands(id, slug, name, status),
  product_translations(lang, slug, name, description, meta_title, meta_description),
  product_images(id, url, sort_order),
  product_stats(review_count, rating_avg, rating_count, recommend_up, recommend_down, photo_count),
  product_categories(category_id)
`;

const productListSelectBase = `
  id,
  slug,
  name,
  description,
  status,
  created_at,
  updated_at,
  brands(id, slug, name, status),
  product_images(id, url, sort_order),
  product_categories(category_id)
`;

const productListSelectWithStats = `
  ${productListSelectBase},
  product_stats(review_count, rating_avg, rating_count, recommend_up, recommend_down, photo_count)
`;

const adminProductSelect = productListSelect;

const productTranslationSelect = `
  product_translations!inner(
    lang,
    slug,
    name,
    description,
    meta_title,
    meta_description
  )
`;

const productListSelectWithTranslations = `
  ${productListSelect},
  ${productTranslationSelect}
`;

async function ensureUniqueProductSlug(
  env: ParsedEnv,
  baseSlug: string
): Promise<string> {
  const supabase = getSupabaseClient(env);
  let candidate = baseSlug;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition -- intentional loop until slug is unique
  while (true) {
    const { data: translation, error: translationError } = await supabase
      .from("product_translations")
      .select("product_id")
      .eq("slug", candidate)
      .maybeSingle();

    if (translationError) {
      throw translationError;
    }

    if (!translation) {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      if (!product) {
        return candidate;
      }
    }

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}

export async function fetchProducts(
  env: ParsedEnv,
  options: {
    categoryId?: number;
    sort: ProductSort;
    page: number;
    pageSize: number;
    lang: SupportedLanguage;
  }
): Promise<ProductListResult> {
  const supabase = getSupabaseClient(env);
  const { categoryId, sort, page, pageSize, lang } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const visibleStatuses: ProductStatus[] = ["published", "hidden", "pending"];
  let query = supabase
    .from("products")
    .select(productListSelectWithStats)
    .in("status", visibleStatuses);

  if (categoryId) {
    // Use !inner to force an inner join for filtering parent rows by child condition
    const selectWithInner = productListSelectWithStats.replace(
      "product_categories(category_id)",
      "product_categories!inner(category_id)"
    );
    query = supabase
      .from("products")
      .select(selectWithInner)
      .in("status", visibleStatuses)
      .eq("product_categories.category_id", categoryId);
  }

  switch (sort) {
    case "rating":
      query = query.order("rating_avg", {
        foreignTable: "product_stats",
        ascending: false,
      });
      break;
    case "popular":
      query = query.order("review_count", {
        foreignTable: "product_stats",
        ascending: false,
      });
      break;
    case "latest":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  const { data, error } = await query.range(from, to);

  if (error) {
    throw error;
  }

  let countQuery = supabase
    .from("products")
    .select(
      categoryId ? "id, product_categories!inner(category_id)" : "id",
      { count: "exact", head: true }
    )
    .in("status", visibleStatuses);

  if (categoryId) {
    countQuery = countQuery.eq("product_categories.category_id", categoryId);
  }

  const { error: countError, count } = await countQuery;

  if (countError) {
    throw countError;
  }

  const productRows = (data ?? []) as DbProductRow[];
  const productIds = productRows.map((row) => row.id).filter(Boolean);
  const translations =
    productIds.length > 0
      ? await fetchProductTranslationsForList(env, productIds, lang)
      : [];
  const translationMap = new Map<string, DbProductTranslationRow>();
  translations.forEach((translation) => {
    translationMap.set(translation.product_id, translation);
  });
  let statsMap = new Map<string, DbProductStatsLookupRow>();
  if (productIds.length > 0) {
    try {
      const statsRows = await fetchProductStatsForList(env, productIds);
      statsMap = new Map(statsRows.map((row) => [row.product_id, row]));
    } catch (error) {
      console.error("Failed to load product stats:", error);
    }
  }

  return {
    items: productRows.map((row) => {
      const translation = translationMap.get(row.id);
      const stats = statsMap.get(row.id);
      const merged = translation
        ? {
          ...row,
          product_translations: [
            {
              lang: translation.lang,
              slug: translation.slug,
              name: translation.name,
              description: translation.description ?? null,
              meta_title: translation.meta_title ?? null,
              meta_description: translation.meta_description ?? null,
            },
          ],
          product_stats: stats ?? undefined,
        }
        : {
          ...row,
          product_stats: stats ?? undefined,
        };
      return mapProductRow(merged as DbProductRow, {
        lang,
        r2BaseUrl: env.R2_PUBLIC_BASE_URL,
      });
    }),
    pageInfo: buildPaginationInfo(page, pageSize, count ?? productRows.length),
  };
}

async function fetchProductTranslationsForList(
  env: ParsedEnv,
  productIds: string[],
  lang: SupportedLanguage
): Promise<DbProductTranslationLookupRow[]> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("product_translations")
    .select("product_id, lang, slug, name, description, meta_title, meta_description")
    .in("product_id", productIds)
    .eq("lang", lang);

  if (error) {
    throw error;
  }

  return (data ?? []) as DbProductTranslationLookupRow[];
}

async function fetchProductStatsForList(
  env: ParsedEnv,
  productIds: string[]
): Promise<DbProductStatsLookupRow[]> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("product_stats")
    .select(
      "product_id, review_count, rating_avg, rating_count, recommend_up, recommend_down, photo_count"
    )
    .in("product_id", productIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as DbProductStatsLookupRow[];
}

async function fetchProductStatsForId(
  env: ParsedEnv,
  productId: string
): Promise<DbProductStatsLookupRow | null> {
  try {
    const rows = await fetchProductStatsForList(env, [productId]);
    return rows[0] ?? null;
  } catch (error) {
    console.error("Failed to load product stats:", error);
    return null;
  }
}

export async function fetchAdminProducts(
  env: ParsedEnv,
  options: {
    q?: string;
    status?: ProductStatus;
    page: number;
    pageSize: number;
    lang: SupportedLanguage;
  }
): Promise<AdminProductListResult> {
  const supabase = getSupabaseClient(env);
  const { q, status, page, pageSize, lang } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const pattern = buildIlikePattern(q);

  let query = supabase
    .from("products")
    .select(adminProductSelect, { count: "exact" })
    .order("created_at", { ascending: false });

  if (pattern) {
    query = query.or(
      [
        `name.ilike.${pattern}`,
        `slug.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `brands.name.ilike.${pattern}`,
        `product_translations.name.ilike.${pattern}`,
      ].join(",")
    );
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: (data ?? []).map((row) =>
      mapProductRow(row as DbProductRow, {
        lang,
        r2BaseUrl: env.R2_PUBLIC_BASE_URL,
      })
    ),
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function fetchAdminProductDetail(
  env: ParsedEnv,
  id: string,
  lang: SupportedLanguage
): Promise<AdminProduct | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("products")
    .select(adminProductSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapProductRow(data as DbProductRow, {
    lang,
    includeTranslations: true,
    r2BaseUrl: env.R2_PUBLIC_BASE_URL,
  });
}

export async function createAdminProduct(
  env: ParsedEnv,
  payload: {
    name: string;
    description?: string | null;
    status?: ProductStatus;
    brandId?: string | null;
    categoryIds?: number[];
    imageUrls?: string[];
  },
  lang: SupportedLanguage
): Promise<AdminProduct> {
  const supabase = getSupabaseClient(env);
  const baseSlug = slugify(payload.name) || `product-${Date.now()}`;
  const slug = await ensureUniqueProductSlug(env, baseSlug);

  const { data, error } = await supabase
    .from("products")
    .insert({
      slug,
      name: payload.name,
      description: payload.description ?? null,
      status: payload.status ?? "published",
      brand_id: payload.brandId ?? null,
    })
    .select(adminProductSelect)
    .single();

  if (error || !data) {
    throw error;
  }

  const { error: translationError } = await supabase
    .from("product_translations")
    .insert({
      product_id: data.id,
      lang,
      slug,
      name: payload.name,
      description: payload.description ?? null,
    });

  if (translationError) {
    throw translationError;
  }

  if (payload.categoryIds && payload.categoryIds.length > 0) {
    const { error: categoryError } = await supabase.from("product_categories").upsert(
      payload.categoryIds.map((categoryId) => ({
        product_id: data.id,
        category_id: categoryId,
      })),
      { onConflict: "product_id,category_id" }
    );
    if (categoryError) {
      throw categoryError;
    }
  }

  if (payload.imageUrls && payload.imageUrls.length > 0) {
    const { error: imageError } = await supabase.from("product_images").insert(
      payload.imageUrls.map((url, index) => ({
        product_id: data.id,
        url,
        sort_order: index,
      }))
    );
    if (imageError) {
      throw imageError;
    }
  }

  const { data: detail, error: detailError } = await supabase
    .from("products")
    .select(adminProductSelect)
    .eq("id", data.id)
    .maybeSingle();

  if (detailError || !detail) {
    throw detailError;
  }

  return mapProductRow(detail as DbProductRow, {
    lang,
    includeTranslations: true,
    r2BaseUrl: env.R2_PUBLIC_BASE_URL,
  });
}

export async function updateAdminProduct(
  env: ParsedEnv,
  id: string,
  payload: {
    name?: string;
    description?: string | null;
    status?: ProductStatus;
    brandId?: string | null;
    categoryIds?: number[] | null;
    imageUrls?: string[] | null;
  },
  lang: SupportedLanguage
): Promise<AdminProduct | null> {
  const supabase = getSupabaseClient(env);
  const updates: Record<string, unknown> = {};
  const translationUpdates: Record<string, unknown> = {};
  const shouldUpdateBase = lang === DEFAULT_LANGUAGE;

  if (payload.name !== undefined) {
    if (shouldUpdateBase) {
      updates.name = payload.name;
    }
    translationUpdates.name = payload.name;
  }
  if (payload.description !== undefined) {
    if (shouldUpdateBase) {
      updates.description = payload.description;
    }
    translationUpdates.description = payload.description;
  }
  if (payload.status !== undefined) {
    updates.status = payload.status;
  }
  if (payload.brandId !== undefined) {
    updates.brand_id = payload.brandId;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("products").update(updates).eq("id", id);
    if (error) {
      throw error;
    }
  }

  if (Object.keys(translationUpdates).length > 0) {
    const { data: existingTranslation, error: existingError } = await supabase
      .from("product_translations")
      .select("slug")
      .eq("product_id", id)
      .eq("lang", lang)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingTranslation) {
      const { error: updateError } = await supabase
        .from("product_translations")
        .update(translationUpdates)
        .eq("product_id", id)
        .eq("lang", lang);
      if (updateError) {
        throw updateError;
      }
    } else if (translationUpdates.name !== undefined) {
      const baseSlug =
        slugify(translationUpdates.name as string) || `product-${Date.now()}`;
      const slug = await ensureUniqueProductSlug(env, baseSlug);
      const { error: insertError } = await supabase
        .from("product_translations")
        .insert({
          product_id: id,
          lang,
          slug,
          ...translationUpdates,
        });
      if (insertError) {
        throw insertError;
      }
    }
  }

  if (payload.categoryIds !== undefined) {
    const { error: deleteError } = await supabase
      .from("product_categories")
      .delete()
      .eq("product_id", id);
    if (deleteError) {
      throw deleteError;
    }

    if (payload.categoryIds && payload.categoryIds.length > 0) {
      const { error: insertError } = await supabase
        .from("product_categories")
        .insert(
          payload.categoryIds.map((categoryId) => ({
            product_id: id,
            category_id: categoryId,
          }))
        );
      if (insertError) {
        throw insertError;
      }
    }
  }

  if (payload.imageUrls !== undefined) {
    const { error: deleteError } = await supabase
      .from("product_images")
      .delete()
      .eq("product_id", id);
    if (deleteError) {
      throw deleteError;
    }

    if (payload.imageUrls && payload.imageUrls.length > 0) {
      const { error: insertError } = await supabase
        .from("product_images")
        .insert(
          payload.imageUrls.map((url, index) => ({
            product_id: id,
            url,
            sort_order: index,
          }))
        );
      if (insertError) {
        throw insertError;
      }
    }
  }

  const { data, error } = await supabase
    .from("products")
    .select(adminProductSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapProductRow(data as DbProductRow, {
    lang,
    includeTranslations: true,
    r2BaseUrl: env.R2_PUBLIC_BASE_URL,
  });
}

export async function fetchProductBySlug(
  env: ParsedEnv,
  slug: string,
  lang: SupportedLanguage
): Promise<Product | null> {
  const supabase = getSupabaseClient(env);
  const translationSelect = `
    product_id,
    lang,
    slug,
    name,
    description,
    meta_title,
    meta_description,
    products(
      ${productListSelectBase},
      product_translations(lang, slug)
    )
  `;

  const { data, error } = await supabase
    .from("product_translations")
    .select(translationSelect)
    .eq("lang", lang)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  let translation = data as
    | (DbProductTranslationRow & {
      product_id: string;
      products: (DbProductRow & { status?: string | null }) | null;
    })
    | null;

  if (!translation) {
    const { data: lookup, error: lookupError } = await supabase
      .from("product_translations")
      .select("product_id")
      .eq("slug", slug)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (!lookup?.product_id) {
      return null;
    }

    // First, try to get translation in the requested lang
    const { data: requestedLangTranslation, error: requestedLangError } = await supabase
      .from("product_translations")
      .select(translationSelect)
      .eq("product_id", lookup.product_id)
      .eq("lang", lang)
      .maybeSingle();

    if (requestedLangError) {
      throw requestedLangError;
    }

    if (requestedLangTranslation) {
      translation = requestedLangTranslation as
        | (DbProductTranslationRow & {
          product_id: string;
          products: (DbProductRow & { status?: string | null }) | null;
        })
        | null;
    }

    // If no translation in requested lang, fallback to DEFAULT_LANGUAGE
    if (!translation) {
      const { data: fallbackTranslation, error: fallbackError } = await supabase
        .from("product_translations")
        .select(translationSelect)
        .eq("product_id", lookup.product_id)
        .eq("lang", DEFAULT_LANGUAGE)
        .maybeSingle();

      if (fallbackError) {
        throw fallbackError;
      }

      translation = fallbackTranslation as
        | (DbProductTranslationRow & {
          product_id: string;
          products: (DbProductRow & { status?: string | null }) | null;
        })
        | null;
    }

    if (!translation) {
      const { data: anyTranslation, error: anyError } = await supabase
        .from("product_translations")
        .select(translationSelect)
        .eq("product_id", lookup.product_id)
        .limit(1)
        .maybeSingle();

      if (anyError) {
        throw anyError;
      }

      translation = anyTranslation as
        | (DbProductTranslationRow & {
          product_id: string;
          products: (DbProductRow & { status?: string | null }) | null;
        })
        | null;
    }
  }

  if (!translation) {
    const { data: productBySlug, error: productError } = await supabase
      .from("products")
      .select(productListSelectBase)
      .eq("slug", slug)
      .maybeSingle();

    if (productError) {
      throw productError;
    }

    if (!productBySlug) {
      return fetchProductByReviewSlug(env, slug, lang);
    }

    const productRow = productBySlug as DbProductRow;
    const status = productRow.status ?? "published";

    if (status === "deleted") {
      return null;
    }

    const translationRows = await fetchProductTranslations(env, productRow.id);
    const translations =
      translationRows.length > 0
        ? translationRows.map((translation) => ({
          lang: translation.lang,
          slug: translation.slug,
          name: translation.name,
          description: translation.description ?? null,
          meta_title: translation.metaTitle ?? null,
          meta_description: translation.metaDescription ?? null,
        }))
        : [
          {
            lang: DEFAULT_LANGUAGE,
            slug: productRow.slug,
            name: productRow.name,
            description: productRow.description ?? null,
            meta_title: null,
            meta_description: null,
          },
        ];
    const stats = await fetchProductStatsForId(env, productRow.id);
    const mergedProduct: DbProductRow = {
      ...productRow,
      product_translations: translations,
      product_stats: stats ?? undefined,
    };

    return mapProductRow(mergedProduct, {
      lang,
      includeTranslations: true,
      r2BaseUrl: env.R2_PUBLIC_BASE_URL,
    });
  }

  if (!translation?.products) {
    if (translation?.product_id) {
      return fetchProductByIdPublic(env, translation.product_id, lang);
    }
    return fetchProductByReviewSlug(env, slug, lang);
  }

  const productRow = translation.products;
  const status = productRow.status ?? "published";

  if (status === "deleted") {
    return null;
  }

  const translationList = Array.isArray(productRow.product_translations)
    ? productRow.product_translations.filter(
      (item): item is { lang: string; slug: string } =>
        Boolean(item) && isSupportedLanguage(item.lang)
    )
    : [];

  const stats = await fetchProductStatsForId(env, productRow.id);
  const mergedProduct: DbProductRow = {
    ...productRow,
    product_translations: [
      {
        lang: translation.lang,
        slug: translation.slug,
        name: translation.name,
        description: translation.description,
        meta_title: translation.meta_title,
        meta_description: translation.meta_description,
      },
      ...translationList
        .filter((item) => item.lang !== translation.lang)
        .map((item) => ({
          lang: item.lang,
          slug: item.slug,
          name: "",
        })),
    ],
    product_stats: stats ?? undefined,
  };

  return mapProductRow(mergedProduct as DbProductRow, {
    lang: translation.lang,
    includeTranslations: true,
    r2BaseUrl: env.R2_PUBLIC_BASE_URL,
  });
}

async function fetchProductByIdPublic(
  env: ParsedEnv,
  productId: string,
  lang: SupportedLanguage
): Promise<Product | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("products")
    .select(productListSelectBase)
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const productRow = data as DbProductRow;
  const status = productRow.status ?? "published";

  if (status === "deleted") {
    return null;
  }

  const translationRows = await fetchProductTranslations(env, productId);
  const translations =
    translationRows.length > 0
      ? translationRows.map((translation) => ({
        lang: translation.lang,
        slug: translation.slug,
        name: translation.name,
        description: translation.description ?? null,
        meta_title: translation.metaTitle ?? null,
        meta_description: translation.metaDescription ?? null,
      }))
      : [
        {
          lang: DEFAULT_LANGUAGE,
          slug: productRow.slug,
          name: productRow.name,
          description: productRow.description ?? null,
          meta_title: null,
          meta_description: null,
        },
      ];
  const stats = await fetchProductStatsForId(env, productRow.id);
  const mergedProduct = {
    ...productRow,
    product_translations: translations,
    product_stats: stats ?? undefined,
  };

  return mapProductRow(mergedProduct as DbProductRow, {
    lang,
    includeTranslations: true,
    r2BaseUrl: env.R2_PUBLIC_BASE_URL,
  });
}

async function fetchProductByReviewSlug(
  env: ParsedEnv,
  slug: string,
  lang: SupportedLanguage
): Promise<Product | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("review_translations")
    .select("review_id, reviews(product_id)")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const { data: reviewRow, error: reviewError } = await supabase
      .from("reviews")
      .select("product_id")
      .eq("slug", slug)
      .maybeSingle();

    if (reviewError) {
      throw reviewError;
    }

    if (!reviewRow?.product_id) {
      return null;
    }

    return fetchProductByIdPublic(env, reviewRow.product_id, lang);
  }

  const reviewRelation = data as {
    reviews?:
    | { product_id?: string | null }
    | { product_id?: string | null }[]
    | null;
  };
  const reviewRow = Array.isArray(reviewRelation.reviews)
    ? reviewRelation.reviews[0]
    : reviewRelation.reviews;
  const productId = reviewRow?.product_id;

  if (!productId) {
    return null;
  }

  return fetchProductByIdPublic(env, productId, lang);
}

export async function fetchProductTranslations(
  env: ParsedEnv,
  productId: string
): Promise<ProductTranslation[]> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("product_translations")
    .select("lang, slug, name, description, meta_title, meta_description")
    .eq("product_id", productId)
    .order("lang");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    lang: row.lang,
    slug: row.slug,
    name: row.name ?? "",
    description: row.description ?? null,
    metaTitle: row.meta_title ?? null,
    metaDescription: row.meta_description ?? null,
  }));
}

export async function upsertProductTranslations(
  env: ParsedEnv,
  productId: string,
  translations: Array<Pick<ProductTranslation, "lang" | "name"> & {
    description?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
  }>
): Promise<ProductTranslation[]> {
  const supabase = getSupabaseClient(env);
  const { data: existing, error: existingError } = await supabase
    .from("product_translations")
    .select("lang, slug")
    .eq("product_id", productId);

  if (existingError) {
    throw existingError;
  }

  const existingMap = new Map<string, DbProductTranslationRow>();
  (existing ?? []).forEach((row) => {
    existingMap.set(row.lang, row as DbProductTranslationRow);
  });

  const rows: Array<{
    product_id: string;
    lang: string;
    slug: string;
    name: string;
    description: string | null;
    meta_title: string | null;
    meta_description: string | null;
  }> = [];

  for (const translation of translations) {
    const trimmedName = translation.name.trim();
    if (!trimmedName) {
      continue;
    }
    const existingRow = existingMap.get(translation.lang);
    let slug = existingRow?.slug;
    if (!slug) {
      const baseSlug = slugify(trimmedName) || `product-${Date.now()}`;
      slug = await ensureUniqueProductSlug(env, baseSlug);
    }
    rows.push({
      product_id: productId,
      lang: translation.lang,
      slug,
      name: trimmedName,
      description: translation.description?.trim() ?? null,
      meta_title: translation.metaTitle?.trim() ?? null,
      meta_description: translation.metaDescription?.trim() ?? null,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("product_translations")
      .upsert(rows, { onConflict: "product_id,lang" });

    if (error) {
      throw error;
    }

    const defaultTranslation = rows.find(
      (row) => row.lang === DEFAULT_LANGUAGE
    );
    if (defaultTranslation) {
      const { error: updateError } = await supabase
        .from("products")
        .update({
          name: defaultTranslation.name,
          description: defaultTranslation.description,
        })
        .eq("id", productId);
      if (updateError) {
        throw updateError;
      }
    }
  }

  return fetchProductTranslations(env, productId);
}

export async function searchProducts(
  env: ParsedEnv,
  options: {
    q: string;
    lang: SupportedLanguage;
    limit: number;
    includePending?: boolean;
  }
): Promise<Product[]> {
  const supabase = getSupabaseClient(env);
  const { q, lang, limit, includePending } = options;
  const normalized = q.trim().replace(/,/g, " ");

  if (!normalized) {
    return [];
  }

  const escaped = normalized.replace(/[%_]/g, "\\$&");
  const pattern = `%${escaped}%`;

  let query = supabase
    .from("product_translations")
    .select(
      `
        product_id,
        lang,
        slug,
        name,
        products(
          ${productListSelectBase}
        )
      `
    )
    .eq("lang", lang)
    .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
    .limit(limit);

  const visibleStatuses: ProductStatus[] = includePending
    ? ["published", "hidden", "pending"]
    : ["published", "hidden"];
  query = query.in("products.status", visibleStatuses);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as any as Array<
    DbProductTranslationRow & { products: DbProductRow | null }
  >;

  return rows
    .map((row) => {
      if (!row.products) {
        return null;
      }
      const merged = {
        ...row.products,
        product_translations: [
          {
            lang: row.lang,
            slug: row.slug,
            name: row.name,
          },
        ],
      };
      return mapProductRow(merged as DbProductRow, {
        lang,
        r2BaseUrl: env.R2_PUBLIC_BASE_URL,
      });
    })
    .filter((item): item is Product => Boolean(item));
}

export async function findOrCreateProduct(
  env: ParsedEnv,
  options: {
    name: string;
    description?: string;
    lang: SupportedLanguage;
    categoryIds?: number[];
    status?: ProductStatus;
  }
): Promise<{ productId: string; isNew: boolean } | null> {
  const supabase = getSupabaseClient(env);
  const name = options.name.trim();

  if (!name) {
    return null;
  }

  const baseSlug = slugify(name) || `product-${Date.now()}`;

  const { data: exactMatch, error: matchError } = await supabase
    .from("product_translations")
    .select("product_id, slug, name, products(status)")
    .eq("slug", baseSlug)
    .maybeSingle();

  if (matchError) {
    throw matchError;
  }

  if (exactMatch?.product_id) {
    return { productId: exactMatch.product_id, isNew: false };
  }

  const { data: nameMatch, error: nameError } = await supabase
    .from("product_translations")
    .select("product_id, slug, name, products(status)")
    .eq("lang", options.lang)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (nameError) {
    throw nameError;
  }

  if (nameMatch?.product_id) {
    return { productId: nameMatch.product_id, isNew: false };
  }

  const slug = await ensureUniqueProductSlug(env, baseSlug);

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      slug,
      name,
      description: options.description ?? null,
      status: options.status ?? "published",
    })
    .select("id")
    .single();

  if (productError || !product) {
    throw productError;
  }

  const { error: translationError } = await supabase
    .from("product_translations")
    .insert({
      product_id: product.id,
      lang: options.lang,
      slug,
      name,
      description: options.description ?? null,
    });

  if (translationError) {
    throw translationError;
  }

  if (options.categoryIds && options.categoryIds.length > 0) {
    const categoryRows = options.categoryIds.map((categoryId) => ({
      product_id: product.id,
      category_id: categoryId,
    }));
    const { error: categoryError } = await supabase
      .from("product_categories")
      .upsert(categoryRows, { onConflict: "product_id,category_id" });
    if (categoryError) {
      throw categoryError;
    }
  }

  return { productId: product.id, isNew: true };
}

export async function attachProductImage(
  env: ParsedEnv,
  options: { productId: string; url: string; sortOrder?: number; userId?: string }
): Promise<void> {
  const supabase = getSupabaseClient(env);
  const { error } = await supabase.from("product_images").insert({
    product_id: options.productId,
    url: options.url,
    sort_order: options.sortOrder ?? 0,
    created_by: options.userId ?? null,
  });

  if (error) {
    throw error;
  }
}
