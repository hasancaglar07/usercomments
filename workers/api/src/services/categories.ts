import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import type { Category } from "../types";
import { mapCategoryRow } from "./mappers";

const categorySelect = "id, name, parent_id";

export async function fetchCategories(env: ParsedEnv): Promise<Category[]> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("categories")
    .select(categorySelect)
    .order("id");

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapCategoryRow);
}

export async function fetchSubcategories(
  env: ParsedEnv,
  parentId: number
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

  return (data ?? []).map(mapCategoryRow);
}
