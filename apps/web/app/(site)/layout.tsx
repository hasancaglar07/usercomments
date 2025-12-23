import "../../styles/globals.css";
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import { AuthProvider } from "../../components/auth/AuthProvider";
import { DEFAULT_LANGUAGE, localizePath, normalizeLanguage, type SupportedLanguage } from "@/src/lib/i18n";
import { getCategories } from "@/src/lib/api";
import { t } from "@/src/lib/copy";
import type { Category } from "@/src/types";
import type { HeaderCategoryLinks } from "../../components/layout/Header";

const HEADER_CATEGORY_ENTRIES = [
  { key: "beauty", labelKey: "header.nav.beauty", pillKey: "catalog.categoryPill.beauty" },
  { key: "tech", labelKey: "header.nav.tech", pillKey: "catalog.categoryPill.technology" },
  { key: "travel", labelKey: "header.nav.travel", pillKey: "catalog.categoryPill.travel" },
  { key: "health", labelKey: "header.nav.health", pillKey: "catalog.categoryPill.health" },
  { key: "auto", labelKey: "header.nav.auto", pillKey: "catalog.categoryPill.automotive" },
  { key: "books", labelKey: "header.nav.books", pillKey: "catalog.categoryPill.books" },
  { key: "kids", labelKey: "header.nav.kids" },
  { key: "finance", labelKey: "header.nav.finance" },
  { key: "movies", labelKey: "header.nav.movies", pillKey: "catalog.categoryPill.movies" },
] as const;

function normalizeCategoryName(value: string, lang: SupportedLanguage): string {
  return value
    .toLocaleLowerCase(lang)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveCategoryId(
  categories: Array<{ id: number; name: string }>,
  candidates: string[],
  lang: SupportedLanguage
): number | undefined {
  const normalizedCandidates = candidates
    .map((candidate) => normalizeCategoryName(candidate, lang))
    .filter(Boolean);

  if (normalizedCandidates.length === 0) {
    return undefined;
  }

  const exactMap = new Map<string, number | null>();
  categories.forEach((category) => {
    if (!exactMap.has(category.name)) {
      exactMap.set(category.name, category.id);
    } else {
      exactMap.set(category.name, null);
    }
  });

  for (const candidate of normalizedCandidates) {
    const exact = exactMap.get(candidate);
    if (typeof exact === "number") {
      return exact;
    }
  }

  return undefined;
}

function buildHeaderCategoryLinks(
  categories: Category[],
  lang: SupportedLanguage
): HeaderCategoryLinks {
  const topLevel = categories.filter((category) => category.parentId == null);
  if (topLevel.length === 0) {
    return {};
  }

  const normalized = topLevel.map((category) => ({
    id: category.id,
    name: normalizeCategoryName(category.name, lang),
  }));

  const links: HeaderCategoryLinks = {};
  HEADER_CATEGORY_ENTRIES.forEach((entry) => {
    const candidates = new Set<string>();
    candidates.add(t(lang, entry.labelKey));
    candidates.add(t(DEFAULT_LANGUAGE, entry.labelKey));
    if (entry.pillKey) {
      candidates.add(t(lang, entry.pillKey));
      candidates.add(t(DEFAULT_LANGUAGE, entry.pillKey));
    }
    const id = resolveCategoryId(normalized, Array.from(candidates), lang);
    if (id) {
      links[entry.key] = localizePath(`/catalog/reviews/${id}`, lang);
    }
  });

  return links;
}

export default async function SiteLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params?: Promise<{ lang?: string }>;
}>) {
  const resolvedParams = await (params ?? Promise.resolve({} as { lang?: string }));
  const lang = normalizeLanguage(resolvedParams?.lang);
  let headerCategoryLinks: HeaderCategoryLinks = {};

  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    try {
      const categories = await getCategories(lang);
      headerCategoryLinks = buildHeaderCategoryLinks(categories, lang);
    } catch (error) {
      console.error("Failed to load header category links", error);
    }
  }

  return (
    <AuthProvider>
      <Header lang={lang} categoryLinks={headerCategoryLinks} />
      {children}
      <Footer lang={lang} />
    </AuthProvider>
  );
}
