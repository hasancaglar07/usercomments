import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import type { Category } from "../types";
import type { SupportedLanguage } from "../utils/i18n";
import { mapCategoryRow } from "./mappers";

type DbCategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  category_translations?: { lang: string; name: string }[] | null;
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
