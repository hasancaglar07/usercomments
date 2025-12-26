"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { signInWithPassword } from "@/src/lib/auth";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { getSupabaseClient } from "@/src/lib/supabase";
import { t } from "@/src/lib/copy";

type OAuthProvider = "google" | "facebook" | "apple";

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const params = useParams();
    const lang = normalizeLanguage(typeof params?.lang === "string" ? params.lang : undefined);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loginSchema = useMemo(
        () =>
            z.object({
                email: z
                    .string()
                    .trim()
                    .email(t(lang, "auth.login.validation.email")),
                password: z
                    .string()
                    .min(6, t(lang, "auth.login.validation.password")),
            }),
        [lang]
    );

    const getRedirectUrl = useCallback(() => {
        const next = searchParams?.get("next");
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const redirectPath = next && next.startsWith("/") ? next : localizePath("/", lang);
        return `${baseUrl}${redirectPath}`;
    }, [searchParams, lang]);

    const handleOAuthLogin = async (provider: OAuthProvider) => {
        setError(null);
        setOauthLoading(provider);
        try {
            const supabase = getSupabaseClient();
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: getRedirectUrl(),
                },
            });
            if (error) {
                throw error;
            }
        } catch {
            setError(t(lang, "auth.login.error.failed"));
            setOauthLoading(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? t(lang, "auth.login.validation.missing"));
            return;
        }

        setIsLoading(true);
        try {
            await signInWithPassword(parsed.data.email, parsed.data.password);

            if (rememberMe) {
                localStorage.setItem("rememberMe", "true");
            } else {
                localStorage.removeItem("rememberMe");
            }

            const next = searchParams?.get("next");
            router.push(
                next && next.startsWith("/") ? next : localizePath("/", lang)
            );
        } catch {
            setError(t(lang, "auth.login.error.failed"));
        } finally {
            setIsLoading(false);
        }
    };

    const isAnyLoading = isLoading || oauthLoading !== null;

    return (
        <div className="w-full max-w-[420px] mx-auto">
            {/* Header - Clean & Minimal */}
            <div className="text-center mb-10">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {t(lang, "auth.login.title")}
                </h1>
                <p className="mt-3 text-slate-500 dark:text-slate-400">
                    {t(lang, "auth.login.subtitle")}
                </p>
            </div>

            {/* Main Card */}
            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-200/50 dark:border-slate-700/50 p-8 sm:p-10">

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl">
                        <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
                    </div>
                )}

                {/* Social Login - Full Width Buttons */}
                <div className="space-y-3">
                    <button
                        onClick={() => handleOAuthLogin("google")}
                        disabled={isAnyLoading}
                        className="w-full flex items-center justify-center gap-3 h-[52px] rounded-2xl bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-lg"
                    >
                        {oauthLoading === "google" ? (
                            <div className="w-5 h-5 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
                        ) : (
                            <svg className="size-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                        )}
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {t(lang, "auth.login.social.google")}
                        </span>
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleOAuthLogin("facebook")}
                            disabled={isAnyLoading}
                            className="flex items-center justify-center gap-2.5 h-[52px] rounded-2xl bg-[#1877F2] hover:bg-[#0d65d8] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/25"
                        >
                            {oauthLoading === "facebook" ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg className="size-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-2.148 0-2.797 1.603-2.797 2.898v1.074h5.441l-.693 3.667h-4.748v7.98c-1.332.175-2.686.175-4.017 0Z" />
                                </svg>
                            )}
                            <span className="text-sm font-semibold text-white">
                                {t(lang, "auth.login.social.facebook")}
                            </span>
                        </button>

                        <button
                            onClick={() => handleOAuthLogin("apple")}
                            disabled={isAnyLoading}
                            className="flex items-center justify-center gap-2.5 h-[52px] rounded-2xl bg-black hover:bg-slate-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
                        >
                            {oauthLoading === "apple" ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg className="size-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.128 3.675-.552 9.093 1.541 12.096 1.037 1.486 2.231 3.13 3.78 3.07 1.541-.06 2.12-.99 3.945-.99 1.832 0 2.373.99 3.974.96 1.64-.03 2.668-1.554 3.711-3.044 1.137-1.636 1.606-3.237 1.632-3.32-.03-.027-3.161-1.217-3.195-4.816-.037-3.012 2.457-4.464 2.572-4.545-1.41-2.071-3.606-2.296-4.379-2.327-1.928-.093-3.528 1.04-4.66 1.04v-.098ZM14.976 2.9c.844-1.011 1.4-2.42 1.246-3.804-1.214.053-2.697.809-3.568 1.835-.78.913-1.464 2.385-1.275 3.784 1.353.106 2.735-.782 3.597-1.815Z" />
                                </svg>
                            )}
                            <span className="text-sm font-semibold text-white">
                                {t(lang, "auth.login.social.apple")}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center">
                        <span className="px-4 bg-white dark:bg-slate-800/50 text-xs font-medium text-slate-400 uppercase tracking-widest">
                            {t(lang, "auth.login.separator")}
                        </span>
                    </div>
                </div>

                {/* Email Form */}
                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t(lang, "auth.login.emailLabel")}
                        </label>
                        <input
                            className="w-full h-[52px] px-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            placeholder={t(lang, "auth.login.emailPlaceholder")}
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isAnyLoading}
                            autoComplete="email"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                {t(lang, "auth.login.passwordLabel")}
                            </label>
                            <Link
                                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                                href={localizePath("/forgot-password", lang)}
                            >
                                {t(lang, "auth.login.forgot")}
                            </Link>
                        </div>
                        <div className="relative">
                            <input
                                className="w-full h-[52px] px-4 pr-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                placeholder="••••••••"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isAnyLoading}
                                autoComplete="current-password"
                            />
                            <button
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                <span className="material-symbols-outlined text-xl">
                                    {showPassword ? "visibility_off" : "visibility"}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Remember Me */}
                    <label className="flex items-center gap-3 cursor-pointer select-none group">
                        <div className="relative">
                            <input
                                className="peer sr-only"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            <div className="w-5 h-5 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                                <svg className={`w-3 h-3 text-white transition-opacity ${rememberMe ? 'opacity-100' : 'opacity-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                            {t(lang, "auth.login.rememberDuration")}
                        </span>
                    </label>

                    {/* Submit Button */}
                    <button
                        className="w-full h-[52px] bg-primary hover:bg-primary/90 text-white font-semibold rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-2"
                        type="submit"
                        disabled={isAnyLoading}
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>{t(lang, "auth.login.submitting")}</span>
                            </>
                        ) : (
                            <span>{t(lang, "auth.login.submit")}</span>
                        )}
                    </button>
                </form>
            </div>

            {/* Footer */}
            <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {t(lang, "auth.login.noAccount")}{" "}
                <Link
                    className="font-semibold text-primary hover:text-primary/80 transition-colors"
                    href={localizePath("/user/register", lang)}
                >
                    {t(lang, "auth.login.signUp")}
                </Link>
            </p>
        </div>
    );
}
