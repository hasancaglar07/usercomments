export default function Loading() {
  return (
    <main className="flex-1 flex justify-center py-10 px-4 sm:px-6 bg-background-light dark:bg-background-dark">
      <div className="layout-content-container flex flex-col max-w-6xl w-full gap-6 animate-pulse">
        <div className="flex flex-wrap gap-2 pb-4">
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-4 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-4 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="flex flex-col gap-3 pb-6 border-b border-[#e7edf3]">
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-80 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`catalog-product-${index}`}
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
