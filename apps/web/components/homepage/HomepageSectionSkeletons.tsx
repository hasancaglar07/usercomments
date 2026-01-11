export function TrendingSectionSkeleton() {
  return (
    <section className="mb-10 animate-pulse">
      <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-5" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`trend-skeleton-${index}`}
            className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900 overflow-hidden"
          >
            <div className="aspect-video w-full bg-slate-200 dark:bg-slate-700" />
            <div className="p-4 space-y-3">
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomepageFeedSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`feed-skeleton-${index}`}
          className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900 p-5"
        >
          <div className="flex gap-4">
            <div className="w-32 h-24 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HomepageSidebarSkeleton() {
  return (
    <div className="w-full lg:w-1/3 space-y-6 animate-pulse">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`sidebar-skeleton-${index}`}
          className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="space-y-3">
            <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
