"use client";

export const runtime = 'edge';

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

export default function Page() {
  const params = useParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      window.alert(t(lang, "auth.forgot.alert.missingEmail"));
      return;
    }
    setIsLoading(true);
    // Logic for forgot password would go here
    setTimeout(() => {
      window.alert(t(lang, "auth.forgot.alert.sent"));
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div
      className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white min-h-screen flex flex-col font-display"
      data-page="forgot-password"
    >
      <main className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[480px]">
          {/* Card Container */}
          <div className="bg-white dark:bg-[#1a2634] shadow-lg rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Page Heading Section */}
            <div className="p-8 pb-4">
              <div className="flex flex-col gap-3 text-center">
                <div className="mx-auto bg-primary/10 size-12 rounded-full flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-primary text-2xl">
                    lock_reset
                  </span>
                </div>
                <h1 className="text-slate-900 dark:text-white tracking-tight text-2xl sm:text-[32px] font-bold leading-tight">
                  {t(lang, "auth.forgot.title")}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-relaxed">
                  {t(lang, "auth.forgot.subtitle")}
                </p>
              </div>
            </div>
            {/* Form Section */}
            <form className="p-8 pt-2 flex flex-col gap-5" onSubmit={handleSubmit}>
              {/* Email Field */}
              <div className="flex flex-col gap-2">
                <label
                  className="text-slate-900 dark:text-white text-sm font-bold leading-normal"
                  htmlFor="email"
                >
                  {t(lang, "auth.forgot.emailLabel")}
                </label>
                <div className="relative">
                  <input
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 pl-11 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    id="email"
                    name="email"
                    placeholder={t(lang, "auth.forgot.emailPlaceholder")}
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                    mail
                  </span>
                </div>
              </div>
              {/* Submit Button */}
              <button
                className="w-full cursor-pointer flex items-center justify-center rounded-lg h-12 bg-primary hover:bg-primary-dark active:bg-primary-dark/90 text-white text-base font-bold leading-normal tracking-[0.015em] transition-all shadow-md hover:shadow-lg transform active:scale-[0.99] disabled:opacity-50"
                type="submit"
                disabled={isLoading}
              >
                {isLoading
                  ? t(lang, "auth.forgot.submitting")
                  : t(lang, "auth.forgot.submit")}
              </button>
              {/* Meta / Helper Links */}
              <div className="flex flex-col items-center gap-4 mt-2">
                <Link
                  className="group flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors"
                  href={localizePath("/user/login", lang)}
                >
                  <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">
                    arrow_back
                  </span>
                  {t(lang, "auth.forgot.back")}
                </Link>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t(lang, "auth.forgot.noAccount")}{" "}
                  <Link
                    className="text-primary font-bold hover:underline"
                    href={localizePath("/user/register", lang)}
                  >
                    {t(lang, "auth.forgot.signUp")}
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
