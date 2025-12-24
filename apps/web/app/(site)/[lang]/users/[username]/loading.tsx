export default function Loading() {
  return (
    <div className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-10 py-8 flex flex-col gap-6 animate-pulse">
      <section className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start w-full">
            <div className="w-28 h-28 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex flex-col gap-3 w-full">
              <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="flex flex-wrap gap-2">
                <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border-light dark:border-border-dark">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`profile-stat-${index}`} className="flex flex-col items-center gap-2">
              <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </section>
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-1/3 flex flex-col gap-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={`profile-side-${index}`}
              className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5 shadow-sm space-y-3"
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
        <main className="w-full lg:w-2/3 flex flex-col gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <article
              key={`profile-card-${index}`}
              className="flex flex-col bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 shadow-sm"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="h-5 w-5 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="flex gap-4 sm:gap-6 flex-col sm:flex-row">
                <div className="w-full sm:w-32 h-48 sm:h-32 rounded-lg bg-slate-200 dark:bg-slate-700" />
                <div className="flex flex-col flex-1 gap-3">
                  <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="mt-auto pt-4 border-t border-border-light dark:border-border-dark flex items-center justify-between">
                    <div className="flex gap-4">
                      <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                    <div className="h-3 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </main>
      </div>
    </div>
  );
}
