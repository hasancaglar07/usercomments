import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKER_ROOT = path.resolve(SCRIPT_DIR, "..");

function loadVarsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      return;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadVarsFile(path.join(WORKER_ROOT, ".dev.vars"));
loadVarsFile(path.join(WORKER_ROOT, ".env"));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_LANG = process.env.DEFAULT_LANGUAGE || "en";
const DRY_RUN = process.env.DRY_RUN === "true";
const PAGE_SIZE = Number(process.env.BACKFILL_PAGE_SIZE || "200");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const slugCache = new Map();
const nameCache = new Map();

const REVIEW_SELECT =
  "id, slug, title, category_id, sub_category_id, product_id, review_translations(lang, slug, title)";

const REVIEW_SUFFIXES = ["-otzyvy", "-reviews", "-review", "-otzyv", "-otziv"];
const TITLE_SEPARATORS = [" - ", " — ", " – ", " | ", " :: ", ": "];

function slugify(value) {
  if (!value) {
    return "";
  }
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase();
  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripReviewSuffix(slug) {
  if (!slug) {
    return "";
  }
  const lowered = slug.toLowerCase();
  for (const suffix of REVIEW_SUFFIXES) {
    if (lowered.endsWith(suffix)) {
      return slug.slice(0, -suffix.length);
    }
  }
  return slug;
}

function inferProductName(title, slug) {
  const cleanedTitle = (title || "").replace(/\s+/g, " ").trim();
  if (cleanedTitle) {
    for (const separator of TITLE_SEPARATORS) {
      if (cleanedTitle.includes(separator)) {
        const candidate = cleanedTitle.split(separator)[0].trim();
        if (candidate.length >= 3) {
          return candidate;
        }
      }
    }
  }
  const slugCandidate = stripReviewSuffix(slug || "");
  if (slugCandidate) {
    return slugCandidate.replace(/-/g, " ").trim();
  }
  if (cleanedTitle) {
    return cleanedTitle.slice(0, 120).trim();
  }
  return "Unknown Product";
}

function escapeIlike(value) {
  return value.replace(/[%_]/g, "\\$&");
}

async function slugExists(slug) {
  if (!slug) {
    return false;
  }
  const cached = slugCache.get(slug);
  if (cached) {
    return true;
  }
  const { data: translation, error: translationError } = await supabase
    .from("product_translations")
    .select("product_id")
    .eq("slug", slug)
    .maybeSingle();
  if (translationError) {
    throw translationError;
  }
  if (translation?.product_id) {
    slugCache.set(slug, translation.product_id);
    return true;
  }
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (productError) {
    throw productError;
  }
  if (product?.id) {
    slugCache.set(slug, product.id);
    return true;
  }
  return false;
}

async function ensureUniqueProductSlug(baseSlug) {
  let candidate = baseSlug;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition -- intentional loop until unique
  while (true) {
    const exists = await slugExists(candidate);
    if (!exists) {
      return candidate;
    }
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}

async function findProductIdBySlug(slug) {
  if (!slug) {
    return null;
  }
  if (slugCache.has(slug)) {
    return slugCache.get(slug) || null;
  }
  const { data: translation, error: translationError } = await supabase
    .from("product_translations")
    .select("product_id")
    .eq("slug", slug)
    .maybeSingle();
  if (translationError) {
    throw translationError;
  }
  if (translation?.product_id) {
    slugCache.set(slug, translation.product_id);
    return translation.product_id;
  }
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (productError) {
    throw productError;
  }
  if (product?.id) {
    slugCache.set(slug, product.id);
    return product.id;
  }
  slugCache.set(slug, null);
  return null;
}

async function findProductIdByName(name, lang) {
  if (!name) {
    return null;
  }
  const normalized = name.toLowerCase();
  const cacheKey = `${lang}:${normalized}`;
  if (nameCache.has(cacheKey)) {
    return nameCache.get(cacheKey) || null;
  }
  const { data, error } = await supabase
    .from("product_translations")
    .select("product_id")
    .eq("lang", lang)
    .ilike("name", escapeIlike(name))
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (data?.product_id) {
    nameCache.set(cacheKey, data.product_id);
    return data.product_id;
  }
  nameCache.set(cacheKey, null);
  return null;
}

function pickTranslation(review) {
  const translations = Array.isArray(review.review_translations)
    ? review.review_translations.filter(Boolean)
    : [];
  const preferred =
    translations.find((item) => item.lang === DEFAULT_LANG) || translations[0];
  return {
    lang: preferred?.lang || DEFAULT_LANG,
    title: preferred?.title || review.title || "",
    slug: preferred?.slug || review.slug || "",
  };
}

async function createProduct({
  name,
  slug,
  lang,
  description,
}) {
  const finalSlug = await ensureUniqueProductSlug(slug);
  if (DRY_RUN) {
    return { id: `dry-run-${finalSlug}`, slug: finalSlug };
  }
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      slug: finalSlug,
      name,
      description: description || null,
      status: "published",
    })
    .select("id, slug")
    .single();
  if (productError) {
    throw productError;
  }
  await supabase.from("product_translations").upsert(
    [
      {
        product_id: product.id,
        lang,
        slug: finalSlug,
        name,
        description: description || null,
      },
    ],
    { onConflict: "product_id,lang" }
  );
  return product;
}

async function ensureProductTranslation(productId, name, slug, lang, description) {
  if (DRY_RUN) {
    return;
  }
  await supabase.from("product_translations").upsert(
    [
      {
        product_id: productId,
        lang,
        slug,
        name,
        description: description || null,
      },
    ],
    { onConflict: "product_id,lang" }
  );
}

async function linkProductCategories(productId, categoryIds) {
  const unique = Array.from(new Set(categoryIds.filter((id) => Number.isFinite(id))));
  if (unique.length === 0 || DRY_RUN) {
    return;
  }
  await supabase.from("product_categories").upsert(
    unique.map((categoryId) => ({
      product_id: productId,
      category_id: categoryId,
    })),
    { onConflict: "product_id,category_id" }
  );
}

async function backfill() {
  let from = 0;
  let processed = 0;
  let linked = 0;
  let created = 0;

  while (true) {
    const { data, error } = await supabase
      .from("reviews")
      .select(REVIEW_SELECT)
      .is("product_id", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const review of data) {
      processed += 1;
      const translation = pickTranslation(review);
      const productName = inferProductName(translation.title, translation.slug);
      const baseSlug =
        slugify(productName) || slugify(stripReviewSuffix(translation.slug)) || "product";

      let productId = await findProductIdBySlug(baseSlug);
      if (!productId) {
        productId = await findProductIdByName(productName, translation.lang);
      }

      let productSlug = baseSlug;
      if (!productId) {
        const product = await createProduct({
          name: productName,
          slug: baseSlug,
          lang: translation.lang,
          description: `Product: ${productName}`,
        });
        productId = product.id;
        productSlug = product.slug;
        created += 1;
      } else {
        const existingSlug = await findProductIdBySlug(baseSlug);
        productSlug = existingSlug ? baseSlug : await ensureUniqueProductSlug(baseSlug);
        await ensureProductTranslation(
          productId,
          productName,
          productSlug,
          translation.lang,
          `Product: ${productName}`
        );
      }

      const categoryIds = [review.category_id, review.sub_category_id].filter(
        (value) => typeof value === "number"
      );
      await linkProductCategories(productId, categoryIds);

      if (!DRY_RUN) {
        await supabase
          .from("reviews")
          .update({ product_id: productId })
          .eq("id", review.id);
      }
      linked += 1;
    }

    from += PAGE_SIZE;
  }

  console.log(
    `Backfill complete. processed=${processed} linked=${linked} created=${created} dryRun=${DRY_RUN}`
  );
}

backfill().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
