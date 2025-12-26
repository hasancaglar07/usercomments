import type { Metadata } from "next";
import RegisterForm from "@/components/auth/RegisterForm";
import { normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

type RegisterPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function Page(props: RegisterPageProps) {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  return (
    <div
      className="flex flex-col min-h-screen font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-50 antialiased overflow-x-hidden"
      data-page="register-page"
    >
      <main className="flex-grow flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[440px] flex flex-col">
          <RegisterForm />
          {/* Security Badge / Trust */}
          <div className="mt-6 flex justify-center gap-6 text-slate-400 grayscale opacity-60">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">
                verified_user
              </span>
              <span className="text-xs font-medium">
                {t(lang, "auth.security.secureRegistration")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">lock</span>
              <span className="text-xs font-medium">
                {t(lang, "auth.security.ssl")}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
