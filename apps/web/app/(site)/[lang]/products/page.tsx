import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/cards/ProductCard";
import ProductFilters from "@/components/catalog/ProductFilters";
import { PaginationCatalog } from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import type { Category } from "@/src/types";
import { getCategoriesDirect, getProductsDirect } from "@/src/lib/api-direct";
import { buildMetadata, toAbsoluteUrl } from "@/src/lib/seo";
import { getCategoryLabel } from "@/src/lib/review-utils";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

export const runtime = 'edge';
export const revalidate = 300;

const DEFAULT_PAGE_SIZE = 12;
const POPULAR_PRODUCTS_LIMIT = 3;
const SORT_VALUES = new Set(["latest", "popular", "rating"]);

type SortValue = "latest" | "popular" | "rating";

type ProductsPageProps = {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    sort?: string;
    categoryId?: string;
  }>;
};

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseOptionalNumber(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.floor(parsed);
}

function parseSort(value?: string): SortValue {
  const normalized = value?.toLowerCase();
  if (normalized && SORT_VALUES.has(normalized)) {
    return normalized as SortValue;
  }
  return "latest";
}

export async function generateMetadata(
  props: ProductsPageProps
): Promise<Metadata> {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const sort = parseSort(searchParams?.sort);
  const categoryId = parseOptionalNumber(searchParams?.categoryId);
  let categoryLabel: string | undefined;

  if (categoryId && process.env.NEXT_PUBLIC_API_BASE_URL) {
    try {
      const categories = await getCategoriesDirect(lang);
      categoryLabel = getCategoryLabel(categories, categoryId);
    } catch {
      categoryLabel = undefined;
    }
  }

  const title = categoryLabel
    ? t(lang, "products.heading.withCategory", { label: categoryLabel })
    : t(lang, "products.meta.title");
  const description = categoryLabel
    ? t(lang, "products.description.withCategory", { label: categoryLabel })
    : t(lang, "products.meta.description");
  const metadata = buildMetadata({
    title,
    description,
    path: "/products",
    lang,
    type: "website",
  });
  const isIndexable =
    page === 1 &&
    pageSize === DEFAULT_PAGE_SIZE &&
    sort === "latest" &&
    !categoryId;

  if (!isIndexable) {
    return {
      ...metadata,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  return metadata;
}

export default async function Page(props: ProductsPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const sort = parseSort(searchParams?.sort);
  const categoryId = parseOptionalNumber(searchParams?.categoryId);

  const [categories, productsResult] = await Promise.all([
    getCategoriesDirect(lang),
    getProductsDirect(page, pageSize, sort, categoryId, lang),
  ]);

  const categoryMap = new Map<number, Category>();
  categories.forEach((category) => categoryMap.set(category.id, category));
  const popularProducts =
    sort === "popular" && page === 1
      ? productsResult.items.slice(0, POPULAR_PRODUCTS_LIMIT)
      : (await getProductsDirect(1, POPULAR_PRODUCTS_LIMIT, "popular", categoryId, lang).catch(
        () => null
      ))?.items ?? [];

  const categoryLabel = categoryId
    ? categoryMap.get(categoryId)?.name ?? t(lang, "category.fallback.label")
    : t(lang, "products.heading.default");
  const heading = categoryId
    ? t(lang, "products.heading.withCategory", { label: categoryLabel })
    : t(lang, "products.heading.default");
  const description = categoryId
    ? t(lang, "products.description.withCategory", { label: categoryLabel })
    : t(lang, "products.description.default");
  const popularCategoryLabel = categoryLabel ?? t(lang, "common.general");
  const popularProductsHref = categoryId
    ? localizePath(`/catalog/list/${categoryId}`, lang)
    : localizePath("/products", lang);
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: categoryLabel,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: productsResult.items.length,
    itemListElement: productsResult.items.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: toAbsoluteUrl(localizePath(`/products/${product.slug}`, lang)),
    })),
  };

  const basePath = localizePath("/products", lang);
  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      params.set("pageSize", String(pageSize));
    }
    if (sort !== "latest") {
      params.set("sort", sort);
    }
    if (categoryId) {
      params.set("categoryId", String(categoryId));
    }
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <main className="flex-1 flex justify-center py-10 px-4 sm:px-6 bg-background-light dark:bg-background-dark">
      <div className="layout-content-container flex flex-col max-w-6xl w-full gap-6">
        <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
        <div className="mb-10 bg-surface-light dark:bg-surface-dark rounded-2xl p-6 md:p-10 shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <nav aria-label="Breadcrumb" className="flex mb-6 relative z-10">
            <ol className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <li>
                <div className="flex items-center">
                  <span className="material-symbols-outlined text-[18px] mr-1">
                    home
                  </span>
                  {t(lang, "catalog.breadcrumb.home")}
                </div>
              </li>
              <li>
                <span className="mx-1 text-gray-300">/</span>
              </li>
              <li className="font-medium text-gray-900 dark:text-gray-100">
                {t(lang, "category.tab.products")}
              </li>
            </ol>
          </nav>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
            <div className="max-w-3xl">
              <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tight text-gray-900 dark:text-white mb-4">
                {heading}
              </h1>
              <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        </div>

        <ProductFilters
          categories={categories}
          lang={lang}
          selectedCategoryId={categoryId}
          selectedSort={sort}
        />

        {productsResult.items.length > 0 ? (
          <div className="space-y-4">
            {productsResult.items.map((product) => {
              const categoryLabel = product.categoryIds?.length
                ? categoryMap.get(product.categoryIds[0])?.name
                : undefined;
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  lang={lang}
                  categoryLabel={categoryLabel}
                />
              );
            })}
            <PaginationCatalog
              pagination={productsResult.pageInfo}
              buildHref={buildHref}
              lang={lang}
            />
          </div>
        ) : (
          <EmptyState
            title={t(lang, "productList.empty.title")}
            description={t(lang, "productList.empty.description")}
            ctaLabel={t(lang, "productList.empty.cta")}
            authenticatedHref="/node/add/review"
          />
        )}
        {popularProducts.length > 0 ? (
          <section className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {t(lang, "productList.popular.title")}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t(lang, "productList.popular.subtitle", {
                    category: popularCategoryLabel,
                  })}
                </p>
              </div>
              <Link
                href={popularProductsHref}
                className="text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
              >
                {t(lang, "productList.popular.viewAll")}
              </Link>
            </div>
            <div className="mt-6 space-y-4">
              {popularProducts.map((product) => {
                const categoryLabel = product.categoryIds?.length
                  ? categoryMap.get(product.categoryIds[0])?.name
                  : undefined;
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    lang={lang}
                    categoryLabel={categoryLabel}
                  />
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
