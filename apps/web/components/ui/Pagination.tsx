import type { PaginationInfo } from "@/src/types";

type PageItem = number | "ellipsis";

const getPageItems = (currentPage: number, totalPages: number): PageItem[] => {
  const pages = new Set<number>([1, 2, 3, totalPages]);
  pages.add(currentPage);
  pages.add(currentPage - 1);
  pages.add(currentPage + 1);

  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const items: PageItem[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous && page - previous > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
};

type PaginationProps = {
  pagination: PaginationInfo;
  buildHref?: (page: number) => string;
};

export function PaginationCatalog({ pagination, buildHref }: PaginationProps) {
  const items = getPageItems(pagination.page, pagination.totalPages);
  const lastPage = Math.max(1, pagination.totalPages);
  const prevPage = Math.max(1, pagination.page - 1);
  const nextPage = Math.min(lastPage, pagination.page + 1);
  const isFirst = pagination.page <= 1;
  const isLast = pagination.totalPages <= 1 || pagination.page >= pagination.totalPages;
  const disabledClass = "pointer-events-none opacity-50";

  return (
    <div className="flex items-center justify-center gap-2 pt-8">
      <a
        aria-disabled={isFirst}
        className={`size-10 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 ${
          isFirst ? disabledClass : ""
        }`}
        href={buildHref ? buildHref(prevPage) : undefined}
      >
        <span className="material-symbols-outlined">chevron_left</span>
      </a>
      {items.map((item, index) => {
        if (item === "ellipsis") {
          return (
            <span key={`ellipsis-${index}`} className="text-slate-400">
              ...
            </span>
          );
        }
        if (item === pagination.page) {
          return (
            <span
              key={`page-${item}`}
              className="size-10 flex items-center justify-center rounded-lg bg-primary text-white font-bold shadow-sm shadow-blue-500/30"
            >
              {item}
            </span>
          );
        }
        return (
          <a
            key={`page-${item}`}
            className="size-10 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
            href={buildHref ? buildHref(item) : undefined}
          >
            {item}
          </a>
        );
      })}
      <a
        aria-disabled={isLast}
        className={`size-10 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 ${
          isLast ? disabledClass : ""
        }`}
        href={buildHref ? buildHref(nextPage) : undefined}
      >
        <span className="material-symbols-outlined">chevron_right</span>
      </a>
    </div>
  );
}

export function PaginationCategory({ pagination, buildHref }: PaginationProps) {
  const items = getPageItems(pagination.page, pagination.totalPages);
  const lastPage = Math.max(1, pagination.totalPages);
  const prevPage = Math.max(1, pagination.page - 1);
  const nextPage = Math.min(lastPage, pagination.page + 1);
  const isFirst = pagination.page <= 1;
  const isLast = pagination.totalPages <= 1 || pagination.page >= pagination.totalPages;
  const disabledClass = "pointer-events-none opacity-50";

  return (
    <div className="flex justify-center mt-6">
      <nav className="flex items-center gap-1">
        <a
          aria-disabled={isFirst}
          className={`size-10 flex items-center justify-center rounded-lg border border-[#e7edf3] text-[#0d141b] hover:bg-[#e7edf3] ${
            isFirst ? disabledClass : ""
          }`}
          href={buildHref ? buildHref(prevPage) : undefined}
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </a>
        {items.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="size-10 flex items-center justify-center text-[#4c739a]"
              >
                ...
              </span>
            );
          }
          if (item === pagination.page) {
            return (
              <span
                key={`page-${item}`}
                className="size-10 flex items-center justify-center rounded-lg bg-primary text-white font-bold"
              >
                {item}
              </span>
            );
          }
          return (
            <a
              key={`page-${item}`}
              className="size-10 flex items-center justify-center rounded-lg border border-[#e7edf3] text-[#0d141b] hover:bg-[#e7edf3] font-medium"
              href={buildHref ? buildHref(item) : undefined}
            >
              {item}
            </a>
          );
        })}
        <a
          aria-disabled={isLast}
          className={`size-10 flex items-center justify-center rounded-lg border border-[#e7edf3] text-[#0d141b] hover:bg-[#e7edf3] ${
            isLast ? disabledClass : ""
          }`}
          href={buildHref ? buildHref(nextPage) : undefined}
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </a>
      </nav>
    </div>
  );
}

export function PaginationProfile({ pagination, buildHref }: PaginationProps) {
  const items = getPageItems(pagination.page, pagination.totalPages);
  const prevPage = Math.max(1, pagination.page - 1);
  const nextPage = Math.min(pagination.totalPages, pagination.page + 1);
  const resolveHref = (page: number) =>
    buildHref ? buildHref(page) : `?page=${page}`;

  return (
    <div className="flex justify-center mt-6">
      <nav
        aria-label="Pagination"
        className="isolate inline-flex -space-x-px rounded-md shadow-sm"
      >
        <a
          className="relative inline-flex items-center rounded-l-md px-2 py-2 text-text-sub-light dark:text-text-sub-dark ring-1 ring-inset ring-border-light dark:ring-border-dark hover:bg-background-light dark:hover:bg-surface-dark focus:z-20 focus:outline-offset-0 bg-surface-light dark:bg-surface-dark"
          href={resolveHref(prevPage)}
        >
          <span className="sr-only">Previous</span>
          <span className="material-symbols-outlined text-[20px]">
            chevron_left
          </span>
        </a>
        {items.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-text-main-light dark:text-text-main-dark ring-1 ring-inset ring-border-light dark:ring-border-dark focus:outline-offset-0 bg-surface-light dark:bg-surface-dark"
              >
                ...
              </span>
            );
          }
          if (item === pagination.page) {
            return (
              <a
                key={`page-${item}`}
                aria-current="page"
                className="relative z-10 inline-flex items-center bg-primary px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href={resolveHref(item)}
              >
                {item}
              </a>
            );
          }
          const isHidden =
            item === 3 || item === pagination.totalPages;
          const baseClass =
            "relative items-center px-4 py-2 text-sm font-semibold text-text-main-light dark:text-text-main-dark ring-1 ring-inset ring-border-light dark:ring-border-dark hover:bg-background-light dark:hover:bg-surface-dark focus:z-20 focus:outline-offset-0 bg-surface-light dark:bg-surface-dark";
          const className = isHidden
            ? `hidden ${baseClass} md:inline-flex`
            : `inline-flex ${baseClass}`;
          return (
            <a key={`page-${item}`} className={className} href={resolveHref(item)}>
              {item}
            </a>
          );
        })}
        <a
          className="relative inline-flex items-center rounded-r-md px-2 py-2 text-text-sub-light dark:text-text-sub-dark ring-1 ring-inset ring-border-light dark:ring-border-dark hover:bg-background-light dark:hover:bg-surface-dark focus:z-20 focus:outline-offset-0 bg-surface-light dark:bg-surface-dark"
          href={resolveHref(nextPage)}
        >
          <span className="sr-only">Next</span>
          <span className="material-symbols-outlined text-[20px]">
            chevron_right
          </span>
        </a>
      </nav>
    </div>
  );
}
