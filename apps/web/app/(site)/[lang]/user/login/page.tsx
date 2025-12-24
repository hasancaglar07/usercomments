import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function Page() {
  return (
    <div
      className="flex flex-col min-h-screen font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-50 antialiased overflow-x-hidden"
      data-page="login-page"
    >
      <main className="flex-grow flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[440px] flex flex-col">
          <LoginForm />
          {/* Security Badge / Trust */}
          <div className="mt-6 flex justify-center gap-6 text-slate-400 grayscale opacity-60">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">
                verified_user
              </span>
              <span className="text-xs font-medium">Secure Login</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">lock</span>
              <span className="text-xs font-medium">256-bit SSL</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
