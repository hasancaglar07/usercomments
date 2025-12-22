import AddReviewClient from "@/components/reviews/AddReviewClient";
import { getCategories } from "@/src/lib/api";
import { allowMockFallback } from "@/src/lib/runtime";
import type { Category } from "@/src/types";

export const runtime = "edge";

export default async function Page() {
  const apiConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
  let categories: Category[] = [];
  let errorMessage: string | null = null;

  if (apiConfigured) {
    try {
      const allCategories = await getCategories();
      categories = allCategories.filter((category) => !category.parentId);
    } catch {
      if (!allowMockFallback) {
        errorMessage = "Unable to load categories. Please try again later.";
      }
    }
  }

  // Fallback for mock data if configured and API fails
  if (categories.length === 0 && allowMockFallback) {
    categories = [
      { id: 1, name: "Technology & Electronics" },
      { id: 2, name: "Beauty & Health" },
      { id: 3, name: "Travel & Hotels" },
      { id: 4, name: "Auto & Moto" },
      { id: 5, name: "Movies & Books" },
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
