import type { PaginationInfo } from "../types/api";

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

export function buildPaginationInfo(
  page: number,
  pageSize: number,
  totalItems: number | null
): PaginationInfo {
  const total = totalItems ?? 0;
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

  return {
    page,
    pageSize,
    totalPages,
    totalItems: totalItems ?? undefined,
  };
}
