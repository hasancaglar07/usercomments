export const runtime = 'edge';

import type { Metadata } from "next";
import AddReviewClient from "@/components/reviews/AddReviewClient";
import { getCategories } from "@/src/lib/api";
import { allowMockFallback } from "@/src/lib/runtime";
import type { Category } from "@/src/types";
import { normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

type AddReviewPageProps = {
  params: Promise<{ lang: string }>;
};


export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default async function Page(props: AddReviewPageProps) {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  const apiConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
  let categories: Category[] = [];
  let errorMessage: string | null = null;

  if (apiConfigured) {
    try {
      const allCategories = await getCategories(lang);
      categories = allCategories.filter((category) => category.parentId == null);
    } catch {
      if (!allowMockFallback) {
        errorMessage = t(lang, "addReview.error.categories");
      }
    }
  }

  // Fallback for mock data if configured and API fails
  if (categories.length === 0 && allowMockFallback) {
    categories = [
      { id: 1, name: t(lang, "addReview.fallbackCategory.tech") },
      { id: 2, name: t(lang, "addReview.fallbackCategory.beauty") },
      { id: 3, name: t(lang, "addReview.fallbackCategory.travel") },
      { id: 4, name: t(lang, "addReview.fallbackCategory.auto") },
      { id: 5, name: t(lang, "addReview.fallbackCategory.moviesBooks") },
    ];
  }

  return (
    <div
      className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased min-h-screen flex flex-col"
      data-page="add-review-page"
    >
      {errorMessage && (
        <div className="max-w-[960px] mx-auto w-full px-4 mt-8">
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {errorMessage}
          </div>
        </div>
      )}

      <AddReviewClient categories={categories} />
    </div>
  );
}
