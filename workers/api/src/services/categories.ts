import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import type { Category, CategoryTranslation } from "../types";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../utils/i18n";
import { mapCategoryRow } from "./mappers";

type DbCategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  category_translations?: { lang: string; name: string }[] | null;
};

type DbCategoryTranslationRow = {
  lang: string;
  name: string;
  slug?: string | null;
};

const categorySelect = "id, name, parent_id, category_translations(lang, name)";

function mapCategoryWithTranslations(
  row: DbCategoryRow,
  lang: SupportedLanguage
): Category {
  const translation = Array.isArray(row.category_translations)
    ? row.category_translations.find((item) => item.lang === lang)
    : null;
  return {
    id: row.id,
    name: translation?.name ?? row.name,
    parentId: row.parent_id,
  };
}

export async function fetchCategories(
  env: ParsedEnv,
  lang: SupportedLanguage
): Promise<Category[]> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("categories")
    .select(categorySelect)
    .order("id");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapCategoryWithTranslations(row as DbCategoryRow, lang));
}

export async function fetchSubcategories(
  env: ParsedEnv,
  parentId: number,
  lang: SupportedLanguage
): Promise<Category[]> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("categories")
    .select(categorySelect)
    .eq("parent_id", parentId)
    .order("id");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapCategoryWithTranslations(row as DbCategoryRow, lang));
}

export async function createCategory(
  env: ParsedEnv,
  payload: { name: string; parentId?: number | null }
): Promise<Category> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: payload.name,
      parent_id: payload.parentId ?? null,
    })
    .select(categorySelect)
    .single();

  if (error || !data) {
    throw error;
  }

  return mapCategoryRow(data as { id: number; name: string; parent_id: number | null });
}

export async function updateCategory(
  env: ParsedEnv,
  id: number,
  payload: { name?: string; parentId?: number | null }
): Promise<Category | null> {
  const supabase = getSupabaseClient(env);
  const updates: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    updates.name = payload.name;
  }
  if (payload.parentId !== undefined) {
    updates.parent_id = payload.parentId;
  }

  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("id", id)
    .select(categorySelect)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapCategoryRow(data as { id: number; name: string; parent_id: number | null });
}

export async function fetchCategoryTranslations(
  env: ParsedEnv,
  categoryId: number
): Promise<CategoryTranslation[]> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("category_translations")
    .select("lang, name, slug")
    .eq("category_id", categoryId)
    .order("lang");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    lang: row.lang,
    name: row.name,
    slug: row.slug ?? null,
  }));
}

export async function upsertCategoryTranslations(
  env: ParsedEnv,
  categoryId: number,
  translations: Array<Pick<CategoryTranslation, "lang" | "name" | "slug">>
): Promise<CategoryTranslation[]> {
  const supabase = getSupabaseClient(env);
  const { data: existing, error: existingError } = await supabase
    .from("category_translations")
    .select("lang, slug")
    .eq("category_id", categoryId);

  if (existingError) {
    throw existingError;
  }

  const existingMap = new Map<string, DbCategoryTranslationRow>();
  (existing ?? []).forEach((row) => {
    existingMap.set(row.lang, row as DbCategoryTranslationRow);
  });

  const rows = translations
    .map((translation) => {
      const trimmedName = translation.name.trim();
      if (!trimmedName) {
        return null;
      }
      const existingRow = existingMap.get(translation.lang);
      const slug = translation.slug ?? existingRow?.slug ?? null;
      return {
        category_id: categoryId,
        lang: translation.lang,
        name: trimmedName,
        slug,
      };
    })
    .filter((row): row is { category_id: number; lang: string; name: string; slug: string | null } =>
      Boolean(row)
    );

  if (rows.length > 0) {
    const { error } = await supabase
      .from("category_translations")
      .upsert(rows, { onConflict: "category_id,lang" });

    if (error) {
      throw error;
    }

    const defaultTranslation = rows.find(
      (row) => row.lang === DEFAULT_LANGUAGE
    );
    if (defaultTranslation) {
      const { error: updateError } = await supabase
        .from("categories")
        .update({ name: defaultTranslation.name })
        .eq("id", categoryId);
      if (updateError) {
        throw updateError;
      }
    }
  }

  return fetchCategoryTranslations(env, categoryId);
}
