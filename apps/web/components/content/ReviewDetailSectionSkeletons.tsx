export function ReviewRelatedSkeleton() {
  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8 animate-pulse">
      <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`related-skeleton-${index}`}
            className="h-16 w-full bg-slate-200 dark:bg-slate-700 rounded"
          />
        ))}
      </div>
    </section>
  );
}

export function ReviewCommentsSkeleton() {
  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8 animate-pulse">
      <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`comment-skeleton-${index}`} className="flex gap-4">
            <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
