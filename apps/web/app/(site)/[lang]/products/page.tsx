import type { Metadata } from "next";
import ProductCard from "@/components/cards/ProductCard";
import ProductFilters from "@/components/catalog/ProductFilters";
import { PaginationCatalog } from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import type { Category } from "@/src/types";
import { getCategories, getProducts } from "@/src/lib/api";
import { buildMetadata, toAbsoluteUrl } from "@/src/lib/seo";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

export const revalidate = 300;

const DEFAULT_PAGE_SIZE = 12;
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
  const lang = normalizeLanguage(params.lang);
  return buildMetadata({
    title: t(lang, "products.meta.title"),
    description: t(lang, "products.meta.description"),
    path: "/products",
    lang,
    type: "website",
  });
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
    getCategories(lang),
    getProducts(page, pageSize, sort, categoryId, lang),
  ]);

  const categoryMap = new Map<number, Category>();
  categories.forEach((category) => categoryMap.set(category.id, category));

  const categoryLabel = categoryId
    ? categoryMap.get(categoryId)?.name ?? t(lang, "category.fallback.label")
    : t(lang, "products.heading.default");
  const heading = categoryId
    ? t(lang, "products.heading.withCategory", { label: categoryLabel })
    : t(lang, "products.heading.default");
  const description = categoryId
    ? t(lang, "products.description.withCategory", { label: categoryLabel })
    : t(lang, "products.description.default");
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
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">
            {heading}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
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
      </div>
    </main>
  );
}
