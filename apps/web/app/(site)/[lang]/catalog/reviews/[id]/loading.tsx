export default function Loading() {
  return (
    <div
      className="bg-background-light dark:bg-background-dark text-[#0d141b] font-display antialiased overflow-x-hidden"
      data-page="category-page"
    >
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-10 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="flex gap-2">
              <div className="h-9 w-28 bg-slate-200 dark:bg-slate-700 rounded-full" />
              <div className="h-9 w-28 bg-slate-200 dark:bg-slate-700 rounded-full" />
            </div>
            <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-80 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="mt-6 animate-pulse">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`category-filter-${index}`}
                  className="h-9 w-24 bg-slate-200 dark:bg-slate-700 rounded-full"
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
            <div className="lg:col-span-8 space-y-6 animate-pulse">
              {Array.from({ length: 3 }).map((_, index) => (
                <article
                  key={`category-card-${index}`}
                  className="flex flex-col md:flex-row gap-5 bg-white p-5 rounded-xl shadow-sm border border-[#e7edf3]"
                >
                  <div className="w-full md:w-48 shrink-0">
                    <div className="aspect-[4/3] md:aspect-square w-full rounded-lg bg-slate-200 dark:bg-slate-700" />
                  </div>
                  <div className="flex flex-col flex-1 gap-3">
                    <div className="h-3 w-36 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="mt-auto pt-3 flex items-center gap-4 border-t border-[#e7edf3]">
                      <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="ml-auto h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <aside className="lg:col-span-4 space-y-6 animate-pulse">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={`category-side-${index}`}
                  className="bg-white p-5 rounded-xl shadow-sm border border-[#e7edf3] space-y-3"
                >
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-3 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                </div>
              ))}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
