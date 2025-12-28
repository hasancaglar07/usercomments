"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { searchProducts } from "@/src/lib/api";
import { t } from "@/src/lib/copy";
import { localizePath, type SupportedLanguage } from "@/src/lib/i18n";
import type { Product, SearchSuggestion } from "@/src/types";
import { formatCompactNumber } from "@/src/lib/review-utils";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";

const SEARCH_DEBOUNCE_MS = 200;
const SUGGESTION_LIMIT = 8;
const RECENT_COOKIE = "ur_search_recent";
const RECENT_LIMIT = 5;
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

const searchQuerySchema = z.string().trim().min(2).max(80);

type SuggestStatus = "idle" | "loading" | "ready" | "error";

type SearchCookieState = {
  recent: string[];
  lastType?: "review" | "product";
};

type NavigationItem = {
  key: string;
  href: string;
  label: string;
  type?: "review" | "product";
  suggestion?: SearchSuggestion;
};

function mapProductToSuggestion(product: Product): SearchSuggestion {
  return {
    id: product.id,
    type: "product",
    slug: product.slug,
    title: product.name,
    imageUrl: product.images?.[0]?.url,
    ratingAvg: product.stats?.ratingAvg,
    ratingCount: product.stats?.ratingCount,
    reviewCount: product.stats?.reviewCount,
  };
}

function normalizeRecentQueries(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(trimmed);
    if (normalized.length >= RECENT_LIMIT) {
      break;
    }
  }
  return normalized;
}

function readSearchCookie(): SearchCookieState {
  if (typeof document === "undefined") {
    return { recent: [] };
  }
  const raw = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${RECENT_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");
  if (!raw) {
    return { recent: [] };
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as SearchCookieState;
    return {
      recent: normalizeRecentQueries(parsed.recent ?? []),
      lastType: parsed.lastType,
    };
  } catch {
    return { recent: [] };
  }
}

function writeSearchCookie(state: SearchCookieState) {
  if (typeof document === "undefined") {
    return;
  }
  const payload = {
    recent: normalizeRecentQueries(state.recent),
    lastType: state.lastType,
  };
  const encoded = encodeURIComponent(JSON.stringify(payload));
  document.cookie = `${RECENT_COOKIE}=${encoded}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

type HeaderSearchProps = {
  lang: SupportedLanguage;
  variant?: "desktop" | "mobile";
};

export default function HeaderSearch({ lang, variant = "desktop" }: HeaderSearchProps) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [status, setStatus] = useState<SuggestStatus>("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [lastType, setLastType] = useState<"review" | "product" | undefined>();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMobile = variant === "mobile";

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const parsedQuery = useMemo(() => searchQuerySchema.safeParse(query), [query]);
  const normalizedQuery = parsedQuery.success ? parsedQuery.data : "";
  const showRecent = !normalizedQuery && recentQueries.length > 0;

  useEffect(() => {
    const state = readSearchCookie();
    setRecentQueries(state.recent);
    setLastType(state.lastType);
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (!normalizedQuery) {
      setSuggestions([]);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    searchTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const result = await searchProducts(
          normalizedQuery,
          SUGGESTION_LIMIT,
          lang,
          true,
          controller.signal
        );
        setSuggestions(result.items.map(mapProductToSuggestion));
        setStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to load search suggestions", error);
        setSuggestions([]);
        setStatus("error");
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [normalizedQuery, lang]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [normalizedQuery, suggestions, recentQueries]);

  useEffect(() => {
    if (open && isMobile) {
      inputRef.current?.focus();
    }
  }, [open, isMobile]);

  const suggestionItems = useMemo<NavigationItem[]>(() => {
    if (!normalizedQuery) {
      return [];
    }
    return suggestions.map((suggestion) => {
      const href =
        suggestion.type === "product"
          ? localizePath(`/products/${suggestion.slug}`, lang)
          : localizePath(`/content/${suggestion.slug}`, lang);
      return {
        key: `${suggestion.type}-${suggestion.id}`,
        href,
        label: suggestion.title,
        type: suggestion.type,
        suggestion,
      };
    });
  }, [lang, normalizedQuery, suggestions]);

  const productSuggestionItems = useMemo(
    () =>
      suggestionItems
        .map((item, index) =>
          item.type === "product" ? { item, index } : null
        )
        .filter(
          (value): value is { item: NavigationItem; index: number } =>
            value !== null
        ),
    [suggestionItems]
  );

  const reviewSuggestionItems = useMemo(
    () =>
      suggestionItems
        .map((item, index) =>
          item.type === "review" ? { item, index } : null
        )
        .filter(
          (value): value is { item: NavigationItem; index: number } =>
            value !== null
        ),
    [suggestionItems]
  );

  const recentItems = useMemo<NavigationItem[]>(() => {
    if (!showRecent) {
      return [];
    }
    return recentQueries.map((value) => {
      const params = new URLSearchParams({ q: value });
      return {
        key: `recent-${value}`,
        href: localizePath(`/search?${params.toString()}`, lang),
        label: value,
      };
    });
  }, [lang, recentQueries, showRecent]);

  const navigableItems = normalizedQuery ? suggestionItems : recentItems;
  const searchAction = localizePath("/search", lang);
  const inputPaddingClass = isMobile ? "pr-10" : "pr-3";
  const dropdownClassName = isMobile
    ? "absolute top-full left-0 right-0 mt-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden max-h-[60vh] overflow-y-auto z-50"
    : "absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50";

  const updateRecent = (value: string, type?: "review" | "product") => {
    const nextRecent = normalizeRecentQueries([value, ...recentQueries]);
    const nextState: SearchCookieState = {
      recent: nextRecent,
      lastType: type ?? lastType,
    };
    setRecentQueries(nextRecent);
    if (type) {
      setLastType(type);
    }
    writeSearchCookie(nextState);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!parsedQuery.success) {
      return;
    }
    updateRecent(parsedQuery.data);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || navigableItems.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) =>
        Math.min(prev + 1, navigableItems.length - 1)
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? navigableItems.length - 1 : prev - 1));
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      const target = navigableItems[activeIndex];
      if (!target) {
        return;
      }
      event.preventDefault();
      updateRecent(target.label, target.type);
      setOpen(false);
      router.push(target.href);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLFormElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setOpen(false);
    setActiveIndex(-1);
  };

  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  const suggestionContent = (
    <div className={isMobile ? "pb-20" : ""}>
      {showRecent ? (
        <div className="px-4 pt-3 pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
          {t(lang, "search.suggest.recent")}
        </div>
      ) : null}

      {showRecent ? (
        <div className="pb-2">
          {recentItems.map((item, index) => (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 sm:py-2.5 text-sm text-gray-700 dark:text-gray-200 transition-colors ${activeIndex === index ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              onClick={() => {
                updateRecent(item.label);
                setOpen(false);
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="material-symbols-outlined text-[20px] sm:text-[18px] text-gray-400">history_edu</span>
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {normalizedQuery ? (
        <div className="pb-2">
          {status === "loading" ? (
            <div className="px-4 py-3 space-y-2">
              {[0, 1, 2].map((item) => (
                <div
                  key={`skeleton-${item}`}
                  className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"
                />
              ))}
            </div>
          ) : null}

          {status === "error" ? (
            <div className="px-4 py-3 text-sm text-red-500">
              {t(lang, "search.suggest.error")}
            </div>
          ) : null}

          {status === "ready" && suggestionItems.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {t(lang, "search.suggest.noResults")}
            </div>
          ) : null}

          {status === "ready" && suggestionItems.length > 0 ? (
            <div>
              {productSuggestionItems.length > 0 ? (
                <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {t(lang, "search.suggest.sectionProducts")}
                </div>
              ) : null}

              {productSuggestionItems.map(({ item, index }) => {
                const suggestion = item.suggestion;
                if (!suggestion) {
                  return null;
                }
                const isActive = activeIndex === index;
                const imageUrl = suggestion.imageUrl
                  ? getOptimizedImageUrl(suggestion.imageUrl, 80)
                  : null;
                const ratingLabel = suggestion.ratingAvg
                  ? suggestion.ratingAvg.toFixed(1)
                  : null;
                const countLabel = ratingLabel && suggestion.ratingCount
                  ? formatCompactNumber(suggestion.ratingCount, lang)
                  : null;
                const reviewCountLabel = suggestion.reviewCount
                  ? formatCompactNumber(suggestion.reviewCount, lang)
                  : null;

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 sm:py-2.5 text-sm transition-colors ${isActive
                      ? "bg-gray-100 dark:bg-gray-800"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    onClick={() => {
                      updateRecent(suggestion.title, suggestion.type);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <div className="h-10 w-10 sm:h-9 sm:w-9 rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageUrl}
                          alt={suggestion.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{suggestion.title.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-gray-800 dark:text-gray-100 text-base sm:text-sm">
                          {suggestion.title}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hidden sm:inline-block">
                          {t(lang, "search.suggest.product")}
                        </span>
                      </div>
                      {(ratingLabel || reviewCountLabel) && (
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {ratingLabel ? (
                            <span className="font-semibold text-gray-600 dark:text-gray-300">
                              {ratingLabel}
                            </span>
                          ) : null}
                          {countLabel ? (
                            <span className="ml-1">({countLabel})</span>
                          ) : null}
                          {reviewCountLabel ? (
                            <span className="ml-2">
                              {reviewCountLabel} {t(lang, "search.suggest.reviewCount")}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}

              {reviewSuggestionItems.length > 0 ? (
                <div
                  className={`px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 ${productSuggestionItems.length > 0
                    ? "border-t border-gray-100 dark:border-gray-800"
                    : ""
                    }`}
                >
                  {t(lang, "search.suggest.sectionReviews")}
                </div>
              ) : null}

              {reviewSuggestionItems.map(({ item, index }) => {
                const suggestion = item.suggestion;
                if (!suggestion) {
                  return null;
                }
                const isActive = activeIndex === index;
                const imageUrl = suggestion.imageUrl
                  ? getOptimizedImageUrl(suggestion.imageUrl, 80)
                  : null;
                const ratingLabel = suggestion.ratingAvg
                  ? suggestion.ratingAvg.toFixed(1)
                  : null;
                const countLabel = ratingLabel && suggestion.ratingCount
                  ? formatCompactNumber(suggestion.ratingCount, lang)
                  : null;

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 sm:py-2.5 text-sm transition-colors ${isActive
                      ? "bg-gray-100 dark:bg-gray-800"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    onClick={() => {
                      updateRecent(suggestion.title, suggestion.type);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <div className="h-10 w-10 sm:h-9 sm:w-9 rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageUrl}
                          alt={suggestion.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{suggestion.title.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-gray-800 dark:text-gray-100 text-base sm:text-sm">
                          {suggestion.title}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hidden sm:inline-block">
                          {t(lang, "search.suggest.review")}
                        </span>
                      </div>
                      {ratingLabel ? (
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-semibold text-gray-600 dark:text-gray-300">
                            {ratingLabel}
                          </span>
                          {countLabel ? (
                            <span className="ml-1">({countLabel})</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : null}

          {status === "ready" && normalizedQuery ? (
            <div className="border-t border-gray-100 dark:border-gray-800">
              <Link
                href={localizePath(
                  `/search?${new URLSearchParams({ q: normalizedQuery }).toString()}`,
                  lang
                )}
                className="flex items-center justify-between px-4 py-3 sm:py-2.5 text-sm font-medium text-primary hover:text-primary-dark"
                onClick={() => {
                  updateRecent(normalizedQuery);
                  setOpen(false);
                }}
              >
                <span>{t(lang, "search.suggest.viewAll")}</span>
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  const dropdown =
    open && (showRecent || normalizedQuery.length > 0) ? (
      <div id={listId} className={dropdownClassName}>
        {suggestionContent}
      </div>
    ) : null;

  if (isMobile) {
    return (
      <div className="md:hidden">
        <button
          type="button"
          className="flex items-center justify-center h-10 w-10 rounded-full text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors active-press"
          onClick={() => setOpen(true)}
          aria-label={t(lang, "common.search")}
        >
          <span className="material-symbols-outlined text-[24px]">search</span>
        </button>
        {open && mounted ? createPortal(
          <div className="fixed inset-0 z-[100] bg-background-light dark:bg-background-dark animate-fade-in flex flex-col">
            <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 safe-area-top">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-gray-400">search</span>
                </div>
                <form
                  action={searchAction}
                  method="get"
                  onSubmit={handleSubmit}
                  className="w-full"
                >
                  <input
                    ref={inputRef}
                    className="block w-full pl-10 pr-10 py-3 border-none rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 text-base shadow-inner/5"
                    name="q"
                    placeholder={t(lang, "header.searchPlaceholder")}
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                  />
                </form>
                {query && (
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 active:text-gray-600"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                  >
                    <span className="material-symbols-outlined text-[20px]">cancel</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                className="text-base font-semibold text-primary active-press px-2"
                onClick={() => setOpen(false)}
              >
                {t(lang, "common.cancel")}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 bg-gray-50/50 dark:bg-black/20">
              {(showRecent || normalizedQuery) && (
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                  {suggestionContent}
                </div>
              )}
            </div>
          </div>,
          document.body
        ) : null}
      </div>
    );
  }

  return (
    <div className="hidden md:flex flex-1 max-w-2xl mx-4">
      <form
        className="relative w-full group"
        action={searchAction}
        method="get"
        onSubmit={handleSubmit}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
      >
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="material-symbols-outlined text-gray-400">search</span>
        </div>
        <input
          ref={inputRef}
          className={`block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg leading-5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition duration-150 ease-in-out`}
          name="q"
          placeholder={t(lang, "header.searchPlaceholder")}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-expanded={open && (showRecent || normalizedQuery.length > 0)}
          aria-controls={listId}
          aria-autocomplete="list"
        />

        {dropdown}
      </form>
    </div>
  );
}
