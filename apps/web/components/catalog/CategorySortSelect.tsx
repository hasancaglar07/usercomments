"use client";

import type { ChangeEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type CategorySortSelectProps = {
  sort: "latest" | "popular" | "rating";
};

const SORT_OPTIONS = [
  { label: "Newest", value: "latest" },
  { label: "Most Helpful", value: "popular" },
  { label: "Highest Rated", value: "rating" },
];

function buildCategoryHref(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default function CategorySortSelect({ sort }: CategorySortSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const selected =
    SORT_OPTIONS.find((option) => option.value === sort)?.value ?? "latest";

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextSort = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (nextSort && nextSort !== "latest") {
      params.set("sort", nextSort);
    } else {
      params.delete("sort");
    }
    router.push(buildCategoryHref(pathname, params));
  };

  return (
    <select
      className="bg-transparent font-bold text-[#0d141b] border-none focus:ring-0 cursor-pointer p-0 pr-6"
      value={selected}
      onChange={handleSortChange}
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.label} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
