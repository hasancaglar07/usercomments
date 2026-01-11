import {
  CatalogHeroSkeleton,
  CatalogListSkeleton,
  CatalogSidebarSkeleton,
} from "@/components/catalog/CatalogSectionSkeletons";

export default function Loading() {
  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-50 font-display min-h-screen flex flex-col">
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <CatalogHeroSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <CatalogListSkeleton />
          <CatalogSidebarSkeleton />
        </div>
      </main>
    </div>
  );
}
