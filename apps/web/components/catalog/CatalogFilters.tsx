"use client";

import type { ChangeEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";

export type CatalogSortOption = {
  label: string;
  value: string;
};

export type CatalogCategoryPill = {
  label: string;
  id?: number;
};

type CatalogSortSelectProps = {
  sort: string;
  options: CatalogSortOption[];
};

type CatalogCategoryChipsProps = {
  categoryId?: number;
  pills: CatalogCategoryPill[];
};

const ACTIVE_PILL_CLASS =
  "px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold shadow-md";
const INACTIVE_PILL_CLASS =
  "px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-primary dark:hover:border-primary transition-all text-sm font-medium";

function buildCatalogHref(params: URLSearchParams, lang: string) {
  const query = params.toString();
  const path = query ? `/catalog?${query}` : "/catalog";
  return localizePath(path, lang);
}

export function CatalogSortSelect({ sort, options }: CatalogSortSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const lang = normalizeLanguage(typeof params?.lang === "string" ? params.lang : undefined);
  const selected =
    options.find((option) => option.value === sort)?.value ?? "latest";

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextSort = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (nextSort && nextSort !== "latest") {
      params.set("sort", nextSort);
    } else {
      params.delete("sort");
    }
    router.push(buildCatalogHref(params, lang));
  };

  return (
    <div className="relative min-w-[180px]">
      <select
        className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-2.5 pl-3 pr-10 rounded-lg text-sm focus:ring-primary focus:border-primary"
        value={selected}
        onChange={handleSortChange}
      >
        {options.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CatalogCategoryChips({
  categoryId,
  pills,
}: CatalogCategoryChipsProps) {
  const searchParams = useSearchParams();
  const params = useParams();
  const lang = normalizeLanguage(typeof params?.lang === "string" ? params.lang : undefined);

  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {pills.map((pill) => {
        const isAll = !pill.id && pill.label === "All";
        const isActive = isAll ? !categoryId : pill.id === categoryId;

        const params = new URLSearchParams(searchParams.toString());
        params.delete("page");
        if (pill.id) {
          params.set("categoryId", String(pill.id));
        } else {
          params.delete("categoryId");
        }

        return (
          <Link
            key={pill.label}
            className={isActive ? ACTIVE_PILL_CLASS : INACTIVE_PILL_CLASS}
            href={buildCatalogHref(params, lang)}
          >
            {pill.label}
          </Link>
        );
      })}
    </div>
  );
}
