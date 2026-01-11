import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import ProductCard from "@/components/cards/ProductCard";
import ProductSortSelect from "@/components/catalog/ProductSortSelect";
import EmptyState from "@/components/ui/EmptyState";
import { PaginationCatalog } from "@/components/ui/Pagination";
import { getCategoriesDirect, getProductsDirect } from "@/src/lib/api-direct";
import { buildMetadata, toAbsoluteUrl } from "@/src/lib/seo";
import { formatNumber, getCategoryLabel } from "@/src/lib/review-utils";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

export const revalidate = 300;

const DEFAULT_PAGE_SIZE = 12;
const POPULAR_PRODUCTS_LIMIT = 3;
const SORT_OPTIONS = new Set(["latest", "popular", "rating"]);

type SortValue = "latest" | "popular" | "rating";

type PageProps = {
  params: Promise<{ lang: string; id: string }>;
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    sort?: string;
  }>;
};

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseSort(value?: string): SortValue {
  const normalized = value?.toLowerCase();
  if (normalized && SORT_OPTIONS.has(normalized)) {
    return normalized as SortValue;
  }
  return "latest";
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const sort = parseSort(searchParams?.sort);
  const categoryId = Number(params.id);
  let categoryLabel: string | undefined;
  let categoryMissing = false;
  const isValidCategoryId = Number.isFinite(categoryId) && categoryId > 0;

  if (!isValidCategoryId) {
    const metadata = buildMetadata({
      title: t(lang, "productList.meta.titleDefault"),
      description: t(lang, "productList.meta.descriptionDefault"),
      path: `/catalog/list/${params.id}`,
      lang,
      type: "website",
    });
    return {
      ...metadata,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  if (Number.isFinite(categoryId)) {
    try {
      const categories = await getCategoriesDirect(lang);
      categoryLabel = getCategoryLabel(categories, categoryId);
      categoryMissing = categories.length > 0 && !categoryLabel;
    } catch {
      categoryLabel = undefined;
    }
  }

  const title = categoryLabel
    ? t(lang, "productList.meta.titleWithLabel", { label: categoryLabel })
    : t(lang, "productList.meta.titleDefault");

  const metadata = buildMetadata({
    title,
    description: categoryLabel
      ? t(lang, "productList.meta.descriptionWithLabel", { label: categoryLabel })
      : t(lang, "productList.meta.descriptionDefault"),
    path: `/catalog/list/${params.id}`,
    lang,
    type: "website",
  });
  const isIndexable =
    page === 1 && pageSize === DEFAULT_PAGE_SIZE && sort === "latest";

  if (!isIndexable || categoryMissing) {
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

export default async function Page(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const lang = normalizeLanguage(params.lang);
  const page = parseNumber(searchParams?.page, 1);
  const pageSize = parseNumber(searchParams?.pageSize, DEFAULT_PAGE_SIZE);
  const sort = parseSort(searchParams?.sort);
  const categoryId = Number(params.id);
  const isValidCategoryId = Number.isFinite(categoryId) && categoryId > 0;

  if (!isValidCategoryId) {
    notFound();
  }

  const [categories, productsResult] = await Promise.all([
    getCategoriesDirect(lang),
    getProductsDirect(page, pageSize, sort, categoryId, lang),
  ]);
  const popularProducts =
    sort === "popular" && page === 1
      ? productsResult.items.slice(0, POPULAR_PRODUCTS_LIMIT)
      : (await getProductsDirect(1, POPULAR_PRODUCTS_LIMIT, "popular", categoryId, lang).catch(
        () => null
      ))?.items ?? [];

  const categoryLabel = getCategoryLabel(categories, categoryId);
  if (!categoryLabel && categories.length > 0) {
    notFound();
  }
  const resolvedCategoryLabel =
    categoryLabel ?? t(lang, "category.fallback.label");
  const popularCategoryLabel = resolvedCategoryLabel ?? t(lang, "common.general");
  const popularProductsHref = localizePath(`/catalog/list/${categoryId}`, lang);
  const basePath = localizePath(`/catalog/list/${categoryId}`, lang);
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
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t(lang, "productList.meta.titleWithLabel", { label: resolvedCategoryLabel }),
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: productsResult.items.length,
    itemListElement: productsResult.items.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: toAbsoluteUrl(localizePath(`/products/${product.slug}`, lang)),
    })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: t(lang, "category.breadcrumb.home"),
        item: toAbsoluteUrl(localizePath("/", lang)),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t(lang, "category.breadcrumb.reviews"),
        item: toAbsoluteUrl(localizePath("/catalog", lang)),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: resolvedCategoryLabel,
        item: toAbsoluteUrl(localizePath(`/catalog/list/${categoryId}`, lang)),
      },
    ],
  };

  return (
    <main className="flex-1 flex justify-center py-10 px-4 sm:px-6 bg-background-light dark:bg-background-dark">
      <div className="layout-content-container flex flex-col max-w-6xl w-full gap-6">
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbJsonLd)}
        </script>
        <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
        <div className="flex flex-wrap gap-2 pb-4">
          <Link
            className="text-[#4c739a] text-sm font-medium hover:text-primary hover:underline"
            href={localizePath("/", lang)}
          >
            {t(lang, "category.breadcrumb.home")}
          </Link>
          <span className="text-[#4c739a] text-sm font-medium">/</span>
          <Link
            className="text-[#4c739a] text-sm font-medium hover:text-primary hover:underline"
            href={localizePath("/catalog", lang)}
          >
            {t(lang, "category.breadcrumb.reviews")}
          </Link>
          <span className="text-[#4c739a] text-sm font-medium">/</span>
          <span className="text-[#0d141b] text-sm font-medium">
            {resolvedCategoryLabel}
          </span>
        </div>

        <div className="flex flex-col gap-3 pb-6 border-b border-[#e7edf3]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[#0d141b] text-4xl font-black leading-tight tracking-[-0.033em]">
              {t(lang, "productList.headingWithLabel", { label: resolvedCategoryLabel })}
            </h1>
            <div className="flex items-center gap-2">
              <Link
                className="flex h-9 items-center justify-center rounded-full bg-[#0d141b] text-white px-5 text-sm font-bold"
                href={localizePath(`/catalog/list/${categoryId}`, lang)}
              >
                {t(lang, "category.tab.products")}
              </Link>
              <Link
                className="flex h-9 items-center justify-center rounded-full bg-white border border-[#e7edf3] px-5 text-sm font-bold text-[#0d141b] hover:border-primary hover:text-primary"
                href={localizePath(`/catalog/reviews/${categoryId}`, lang)}
              >
                {t(lang, "category.tab.reviews")}
              </Link>
            </div>
          </div>
          <p className="text-[#4c739a] text-lg font-normal max-w-3xl">
            {t(lang, "productList.subtitle", { label: resolvedCategoryLabel })}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t(lang, "productList.countLabel", {
              count: formatNumber(
                productsResult.pageInfo.totalItems ?? productsResult.items.length,
                lang
              ),
            })}
          </p>
          <div className="flex items-center gap-2 text-sm text-[#4c739a]">
            <span>{t(lang, "productList.sortBy")}</span>
            <Suspense fallback={null}>
              <ProductSortSelect sort={sort} />
            </Suspense>
          </div>
        </div>

        {productsResult.items.length > 0 ? (
          <div className="space-y-4">
            {productsResult.items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                lang={lang}
                categoryLabel={resolvedCategoryLabel}
              />
            ))}
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
                <h2 className="text-2xl font-bold text-[#0d141b]">
                  {t(lang, "productList.popular.title")}
                </h2>
                <p className="text-sm text-[#4c739a]">
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
              {popularProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  lang={lang}
                  categoryLabel={resolvedCategoryLabel}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
