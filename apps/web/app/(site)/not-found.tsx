import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center bg-surface-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark">
      <h1 className="text-6xl font-black text-primary mb-4">404</h1>
      <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
      <p className="text-text-sub-light dark:text-text-sub-dark mb-8 max-w-md">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-dark transition-all hover:scale-105 shadow-sm"
        >
          Go Home
        </Link>
        <Link
          href="/catalog"
          className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-6 py-3 rounded-xl font-bold hover:border-primary hover:text-primary transition-all"
        >
          Browse Catalog
        </Link>
      </div>

      <div className="mt-12 p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full">
        <h3 className="text-lg font-bold mb-4">Popular Categories</h3>
        <div className="flex flex-wrap justify-center gap-2">
          {["Technology", "Beauty", "Travel", "Books", "Movies", "Health"].map((cat) => (
            <Link
              key={cat}
              href={`/search?q=${cat}`}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              {cat}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
