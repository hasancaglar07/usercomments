export default function Loading() {
  return (
    <main className="flex-1 flex justify-center py-10 px-4 sm:px-6 bg-background-light dark:bg-background-dark">
      <div className="layout-content-container flex flex-col max-w-6xl w-full gap-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-72 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`products-filter-${index}`}
              className="h-9 w-24 bg-slate-200 dark:bg-slate-700 rounded-full"
            />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`product-card-${index}`}
              className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="h-28 w-full sm:w-36 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
