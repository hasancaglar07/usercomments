export default function Loading() {
  return (
    <div
      className="bg-surface-light dark:bg-background-dark font-display text-text-main antialiased min-h-screen flex flex-col"
      data-page="leaderboard-page"
    >
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-8">
          <div className="rounded-3xl border border-border-light dark:border-border-dark p-6 sm:p-10 bg-white/70">
            <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded-full" />
            <div className="mt-4 h-10 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="mt-3 h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="h-8 w-40 bg-slate-200 dark:bg-slate-700 rounded-full" />
              <div className="h-8 w-36 bg-slate-200 dark:bg-slate-700 rounded-full" />
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`metric-tab-${index}`}
                  className="h-10 w-28 bg-slate-200 dark:bg-slate-700 rounded-full"
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`time-tab-${index}`}
                  className="h-10 w-28 bg-slate-200 dark:bg-slate-700 rounded-full"
                />
              ))}
            </div>
          </div>

          <div>
            <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="mt-2 h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`podium-${index}`}
                  className="h-56 rounded-3xl border border-border-light dark:border-border-dark bg-white/70"
                />
              ))}
            </div>
          </div>

          <div>
            <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="mt-2 h-4 w-52 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="mt-6 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`row-${index}`}
                  className="h-20 rounded-2xl border border-border-light dark:border-border-dark bg-white/70"
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
