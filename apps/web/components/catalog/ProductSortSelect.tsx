"use client";

import type { ChangeEvent } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

type ProductSortSelectProps = {
  sort: "latest" | "popular" | "rating";
};

function buildHref(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default function ProductSortSelect({ sort }: ProductSortSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const params = useParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );
  const sortOptions = [
    { label: t(lang, "productList.sort.newest"), value: "latest" },
    { label: t(lang, "productList.sort.highestRated"), value: "rating" },
    { label: t(lang, "productList.sort.mostReviewed"), value: "popular" },
  ];
  const selected =
    sortOptions.find((option) => option.value === sort)?.value ?? "latest";

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextSort = event.target.value;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("page");
    if (nextSort && nextSort !== "latest") {
      params.set("sort", nextSort);
    } else {
      params.delete("sort");
    }
    router.push(buildHref(pathname ?? "", params));
  };

  return (
    <select
      className="bg-transparent font-bold text-[#0d141b] border-none focus:ring-0 cursor-pointer p-0 pr-6"
      value={selected}
      onChange={handleSortChange}
    >
      {sortOptions.map((option) => (
        <option key={option.label} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
