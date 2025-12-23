"use client";

import type { ChangeEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/src/types";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";

type SearchCategoryFilterProps = {
  categories: Category[];
  selectedId?: number;
};

function buildSearchHref(params: URLSearchParams, lang: string) {
  const query = params.toString();
  const path = query ? `/search?${query}` : "/search";
  return localizePath(path, lang);
}

export default function SearchCategoryFilter({
  categories,
  selectedId,
}: SearchCategoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const lang = normalizeLanguage(typeof params?.lang === "string" ? params.lang : undefined);
  const selectedValue = selectedId ? String(selectedId) : "";

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (nextValue) {
      params.set("categoryId", nextValue);
    } else {
      params.delete("categoryId");
    }
    router.push(buildSearchHref(params, lang));
  };

  return (
    <div className="relative min-w-[200px]">
      <select
        className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-2.5 pl-3 pr-10 rounded-lg text-sm focus:ring-primary focus:border-primary"
        value={selectedValue}
        onChange={handleChange}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>
  );
}
