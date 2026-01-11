export function CatalogHeroSkeleton() {
  return (
    <>
      <div className="mb-6 animate-pulse">
        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
      <div className="mb-8 animate-pulse space-y-4">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-4 w-72 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-10 w-44 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={`catalog-pill-${index}`}
              className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-full"
            />
          ))}
        </div>
      </div>
    </>
  );
}

export function CatalogListSkeleton() {
  return (
    <div className="lg:col-span-8 space-y-6 animate-pulse">
      {Array.from({ length: 4 }).map((_, index) => (
        <article
          key={`catalog-card-${index}`}
          className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden"
        >
          <div className="p-6 sm:flex gap-6">
            <div className="sm:w-48 sm:shrink-0 mb-4 sm:mb-0">
              <div className="aspect-video sm:aspect-[4/3] w-full bg-slate-200 dark:bg-slate-700 rounded-lg" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="mt-auto flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-4">
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function CatalogSidebarSkeleton() {
  return (
    <div className="lg:col-span-4 space-y-6 animate-pulse">
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={`catalog-side-${index}`}
          className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 space-y-3"
        >
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
