import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function Page() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  let apiStatus = "API base URL is not set.";
  let apiOk = false;

  if (apiBaseUrl) {
    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/health`, {
        cache: "no-store",
      });
      apiOk = response.ok;
      apiStatus = response.ok
        ? "API reachable."
        : `API responded with ${response.status}.`;
    } catch (error) {
      apiStatus =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "API unreachable.";
    }
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen flex flex-col">
      <main className="flex-grow max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-4">Health Check</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
          API base URL: {apiBaseUrl ?? "Not configured"}
        </p>
        <p
          className={`text-sm font-semibold ${apiOk ? "text-green-600 dark:text-green-400" : "text-red-500"
            }`}
        >
          {apiStatus}
        </p>
      </main>
    </div>
  );
}
