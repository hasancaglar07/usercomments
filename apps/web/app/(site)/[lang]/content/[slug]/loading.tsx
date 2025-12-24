export default function Loading() {
  return (
    <div className="w-full flex justify-center py-6 px-4 md:px-10 lg:px-20 bg-background-light dark:bg-background-dark">
      <div className="layout-content-container w-full max-w-7xl animate-pulse">
        <div className="h-4 w-56 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 w-full lg:w-2/3 flex flex-col gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
              <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`review-section-${index}`}
                  className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded"
                />
              ))}
            </div>
          </div>

          <aside className="w-full lg:w-1/3 space-y-6">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`review-side-${index}`}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-3"
              >
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}
