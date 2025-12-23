"use client";

import type { ChangeEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/src/types";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

type SortValue = "latest" | "rating" | "popular";

type ProductFiltersProps = {
  categories: Category[];
  lang: string;
  selectedCategoryId?: number;
  selectedSort: SortValue;
};

function buildHref(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default function ProductFilters({
  categories,
  lang,
  selectedCategoryId,
  selectedSort,
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedLang = normalizeLanguage(lang);
  const sortOptions: Array<{ label: string; value: SortValue }> = [
    { label: t(resolvedLang, "productList.sort.newest"), value: "latest" },
    { label: t(resolvedLang, "productList.sort.highestRated"), value: "rating" },
    { label: t(resolvedLang, "productList.sort.mostReviewed"), value: "popular" },
  ];

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextSort = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (nextSort && nextSort !== "latest") {
      params.set("sort", nextSort);
    } else {
      params.delete("sort");
    }
    router.push(buildHref(pathname, params));
  };

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextCategoryId = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (nextCategoryId) {
      params.set("categoryId", nextCategoryId);
    } else {
      params.delete("categoryId");
    }
    router.push(buildHref(pathname, params));
  };

  return (
    <div className="grid gap-3 md:grid-cols-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="grid gap-2">
        <label className="text-xs text-slate-500 dark:text-slate-400">
          {t(resolvedLang, "search.categoryLabel")}
        </label>
        <select
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          value={selectedCategoryId ? String(selectedCategoryId) : ""}
          onChange={handleCategoryChange}
        >
          <option value="">{t(resolvedLang, "search.allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <label className="text-xs text-slate-500 dark:text-slate-400">
          {t(resolvedLang, "productList.sortBy")}
        </label>
        <select
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          value={selectedSort}
          onChange={handleSortChange}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <label className="text-xs text-slate-500 dark:text-slate-400">
          {t(resolvedLang, "productFilters.actions")}
        </label>
        <Link
          className="inline-flex items-center justify-center rounded-lg bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary-dark"
          href={localizePath("/node/add/review", lang)}
        >
          {t(resolvedLang, "productDetail.cta.writeReview")}
        </Link>
      </div>
    </div>
  );
}
