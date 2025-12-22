"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signUpWithPassword } from "@/src/lib/auth";

export default function RegisterForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            window.alert("Please enter your email and password.");
            return;
        }

        setIsLoading(true);
        try {
            const result = await signUpWithPassword(email, password);
            if (!result.session) {
                window.alert("Check your email to confirm your account.");
                return;
            }
            const next = searchParams.get("next");
            router.push(next && next.startsWith("/") ? next : "/");
        } catch (error) {
            const message =
                error && typeof error === "object" && "message" in error
                    ? String(error.message)
                    : "Sign up failed.";
            window.alert(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 p-6 sm:p-8">
            {/* Heading */}
            <div className="mb-8 text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                    Sign Up
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Join our community and share your reviews.
                </p>
            </div>

            {/* Social Register Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                    aria-label="Sign up with Google"
                    className="flex items-center justify-center h-12 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors group"
                >
                    <svg className="size-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                        ></path>
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        ></path>
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                        ></path>
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        ></path>
                    </svg>
                </button>
                <button
                    aria-label="Sign up with Facebook"
                    className="flex items-center justify-center h-12 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors"
                >
                    <svg className="size-6 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-2.148 0-2.797 1.603-2.797 2.898v1.074h5.441l-.693 3.667h-4.748v7.98c-1.332.175-2.686.175-4.017 0Z"></path>
                    </svg>
                </button>
                <button
                    aria-label="Sign up with Apple"
                    className="flex items-center justify-center h-12 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors"
                >
                    <svg className="size-5 text-slate-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.128 3.675-.552 9.093 1.541 12.096 1.037 1.486 2.231 3.13 3.78 3.07 1.541-.06 2.12-.99 3.945-.99 1.832 0 2.373.99 3.974.96 1.64-.03 2.668-1.554 3.711-3.044 1.137-1.636 1.606-3.237 1.632-3.32-.03-.027-3.161-1.217-3.195-4.816-.037-3.012 2.457-4.464 2.572-4.545-1.41-2.071-3.606-2.296-4.379-2.327-1.928-.093-3.528 1.04-4.66 1.04v-.098ZM14.976 2.9c.844-1.011 1.4-2.42 1.246-3.804-1.214.053-2.697.809-3.568 1.835-.78.913-1.464 2.385-1.275 3.784 1.353.106 2.735-.782 3.597-1.815Z"></path>
                    </svg>
                </button>
            </div>

            <div className="relative flex py-2 items-center mb-6">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-semibold tracking-wider">
                    or with email
                </span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
                {/* Email */}
                <label className="block">
                    <span className="text-slate-900 dark:text-slate-200 text-sm font-medium mb-1.5 block">
                        Email Address
                    </span>
                    <div className="relative">
                        <input
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg h-12 px-4 pl-11 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            placeholder="email@example.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                        />
                        <div className="absolute left-0 top-0 h-full w-11 flex items-center justify-center text-slate-400 pointer-events-none">
                            <span className="material-symbols-outlined text-[20px]">mail</span>
                        </div>
                    </div>
                </label>

                {/* Password */}
                <label className="block">
                    <div className="flex justify-between items-center mb-1.5">
                        <span className="text-slate-900 dark:text-slate-200 text-sm font-medium">
                            Password
                        </span>
                    </div>
                    <div className="relative">
                        <input
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg h-12 px-4 pl-11 pr-11 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            placeholder="********"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                        />
                        <div className="absolute left-0 top-0 h-full w-11 flex items-center justify-center text-slate-400 pointer-events-none">
                            <span className="material-symbols-outlined text-[20px]">lock</span>
                        </div>
                        <button
                            className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            <span className="material-symbols-outlined text-[20px]">
                                {showPassword ? "visibility_off" : "visibility"}
                            </span>
                        </button>
                    </div>
                </label>

                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input
                                className="peer h-5 w-5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-primary focus:ring-offset-0 focus:ring-primary/20 transition-all cursor-pointer"
                                type="checkbox"
                            />
                        </div>
                        <span className="text-slate-600 dark:text-slate-300 text-sm font-normal group-hover:text-slate-800 dark:group-hover:text-white transition-colors">
                            I am not a robot
                        </span>
                    </label>
                </div>

                {/* Submit Button */}
                <button
                    className="w-full h-12 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="submit"
                    disabled={isLoading}
                >
                    <span>{isLoading ? "Signing up..." : "Sign Up"}</span>
                    {!isLoading && (
                        <span className="material-symbols-outlined text-[20px]">
                            arrow_forward
                        </span>
                    )}
                </button>
            </form>

            {/* Login Footer */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Already have an account?
                    <Link
                        className="font-bold text-primary hover:text-blue-600 dark:hover:text-blue-400 ml-1 transition-colors"
                        href="/user/login"
                    >
                        Log In
                    </Link>
                </p>
            </div>
        </div>
    );
}
