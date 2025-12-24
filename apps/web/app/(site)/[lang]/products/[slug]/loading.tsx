export default function Loading() {
  return (
    <main className="flex-1 flex justify-center py-10 px-4 sm:px-6 bg-background-light dark:bg-background-dark">
      <div className="layout-content-container flex flex-col max-w-6xl w-full gap-8 animate-pulse">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm">
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div className="aspect-square w-full rounded-xl bg-slate-200 dark:bg-slate-700" />
            <div className="flex flex-col gap-4">
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="space-y-2">
                <div className="h-7 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="flex flex-wrap gap-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`product-stat-${index}`} className="space-y-2">
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="h-9 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="h-9 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`product-review-${index}`}
              className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="h-24 w-full sm:w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-5 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
