import { supabase } from "../db/supabase";
import type { Category } from "../types/api";
import { mapCategoryRow } from "./mappers";

const categorySelect = "id, name, parent_id";

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select(categorySelect)
    .order("id");

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapCategoryRow);
}

export async function fetchSubcategories(parentId: number): Promise<Category[]> {
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
