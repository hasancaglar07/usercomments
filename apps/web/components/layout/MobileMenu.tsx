"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";
import type { Category } from "@/src/types";
import AuthCtaButton from "@/components/auth/AuthCtaButton";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";

type MobileMenuProps = {
    isOpen: boolean;
    onClose: () => void;
    lang: string;
    categories: Category[];
};

export default function MobileMenu({
    isOpen,
    onClose,
    lang,
    categories,
}: MobileMenuProps) {
    const { user, isAuthenticated } = useAuth();
    const [mounted, setMounted] = useState(false);
    const resolvedLang = normalizeLanguage(lang);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!mounted) return null;

    const content = (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer */}
            <div
                className={`fixed inset-y-0 left-0 z-[101] w-[280px] bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark">
                    <Link
                        className="flex items-center gap-2"
                        href={localizePath("/", resolvedLang)}
                        onClick={onClose}
                    >
                        <span className="material-symbols-outlined text-primary text-2xl">
                            forum
                        </span>
                        <span className="text-xl font-bold tracking-tight text-primary">
                            UserReview
                        </span>
                    </Link>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full text-text-sub-light dark:text-text-sub-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors active-press"
                        aria-label={t(resolvedLang, "common.close")}
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto py-4 px-4 space-y-6">
                    {/* Main Navigation */}
                    <nav className="space-y-1">
                        <Link
                            href={localizePath("/", resolvedLang)}
                            onClick={onClose}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-main-light dark:text-text-main-dark hover:bg-gray-100 dark:hover:bg-gray-800 active-press"
                        >
                            <span className="material-symbols-outlined text-xl text-text-muted">home</span>
                            {t(resolvedLang, "header.home" as any) || "Home"}
                        </Link>

                        <Link
                            href={localizePath("/catalog", resolvedLang)}
                            onClick={onClose}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-main-light dark:text-text-main-dark hover:bg-gray-100 dark:hover:bg-gray-800 active-press"
                        >
                            <span className="material-symbols-outlined text-xl text-text-muted">category</span>
                            {t(resolvedLang, "header.catalog" as any) || "Catalog"}
                        </Link>

                        <Link
                            href={localizePath("/leaderboard", resolvedLang)}
                            onClick={onClose}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-main-light dark:text-text-main-dark hover:bg-gray-100 dark:hover:bg-gray-800 active-press"
                        >
                            <span className="material-symbols-outlined text-xl text-text-muted">leaderboard</span>
                            {t(resolvedLang, "footer.leaderboard")}
                        </Link>
                    </nav>

                    {/* Categories Section */}
                    {categories.length > 0 && (
                        <div className="pt-4 border-t border-border-light dark:border-border-dark">
                            <h3 className="px-3 mb-2 text-xs font-semibold text-text-sub-light dark:text-text-sub-dark uppercase tracking-wider">
                                {t(resolvedLang, "footer.categories")}
                            </h3>
                            <nav className="space-y-1">
                                {categories.slice(0, 8).map((cat) => (
                                    <Link
                                        key={cat.id}
                                        href={localizePath(`/catalog/reviews/${cat.id}`, resolvedLang)}
                                        onClick={onClose}
                                        className="block px-3 py-2 rounded-lg text-sm text-text-main-light dark:text-text-main-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors truncate active-press"
                                    >
                                        {cat.name}
                                    </Link>
                                ))}
                                <Link
                                    href={localizePath("/catalog", resolvedLang)}
                                    onClick={onClose}
                                    className="block px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/5 active-press"
                                >
                                    {t(resolvedLang, "search.suggest.viewAll")}
                                </Link>
                            </nav>
                        </div>
                    )}

                    {/* User Section (Mobile Only View) */}
                    <div className="pt-4 border-t border-border-light dark:border-border-dark">
                        {isAuthenticated ? (
                            <div className="space-y-3">
                                <Link
                                    href={localizePath(`/users/${user?.user_metadata?.username || user?.email?.split('@')[0]}`, resolvedLang)}
                                    onClick={onClose}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 active-press"
                                >
                                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                        {user?.email?.[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-text-main-light dark:text-text-main-dark truncate">
                                            {user?.user_metadata?.username || "Start Writing"}
                                        </p>
                                        <p className="text-xs text-text-sub-light dark:text-text-sub-dark">
                                            {t(resolvedLang, "sidebar.viewProfile" as any) || "View Profile"}
                                        </p>
                                    </div>
                                </Link>
                                <AuthCtaButton
                                    as="a"
                                    authenticatedHref={localizePath("/node/add/review", resolvedLang)}
                                    className="w-full flex items-center justify-center gap-2 btn-primary py-2.5 rounded-lg text-sm font-bold shadow-sm"
                                    onClick={onClose}
                                >
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                    {t(resolvedLang, "header.addReview")}
                                </AuthCtaButton>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <Link
                                    href={localizePath("/user/login", resolvedLang)}
                                    onClick={onClose}
                                    className="w-full flex items-center justify-center py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 font-bold text-text-main-light dark:text-text-main-dark hover:bg-gray-50 dark:hover:bg-gray-800 active-press"
                                >
                                    {t(resolvedLang, "header.signIn")}
                                </Link>
                                <Link
                                    href={localizePath("/user/register", resolvedLang)}
                                    onClick={onClose}
                                    className="w-full flex items-center justify-center py-2.5 rounded-lg bg-primary text-white font-bold shadow-sm hover:bg-primary-dark active-press"
                                >
                                    {t(resolvedLang, "sidebar.signUpFree")}
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-gray-800/20">
                    <LanguageSwitcher
                        currentLang={resolvedLang}
                        label={t(resolvedLang, "language.label")}
                        className="flex items-center justify-between text-sm text-text-sub-light dark:text-text-sub-dark"
                        selectClassName="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm outline-none"
                    />
                    <div className="mt-4 flex gap-4 text-xs text-text-muted justify-center">
                        <Link href={localizePath("/privacy-policy", resolvedLang)} onClick={onClose}>
                            {t(resolvedLang, "footer.privacyPolicy")}
                        </Link>
                        <Link href={localizePath("/terms-of-use", resolvedLang)} onClick={onClose}>
                            {t(resolvedLang, "footer.rules")}
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(content, document.body);
}

