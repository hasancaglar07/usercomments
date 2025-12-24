export default function Loading() {
  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-72 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-9 w-56 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="mt-6 space-y-6 animate-pulse">
          {Array.from({ length: 4 }).map((_, index) => (
            <article
              key={`search-card-${index}`}
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
      </main>
    </div>
  );
}
