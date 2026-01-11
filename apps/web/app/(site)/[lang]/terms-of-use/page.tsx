export const runtime = 'edge';

import Link from "next/link";
import type { Metadata } from "next";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { buildMetadata } from "@/src/lib/seo";
import { t } from "@/src/lib/copy";

export const revalidate = 86400;

type TermsPageProps = {
    params: Promise<{ lang: string }>;
};

export default async function Page(props: TermsPageProps) {
    const params = await props.params;
    const lang = normalizeLanguage(params.lang);
    return (
        <div
            className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased"
            data-page="terms-of-use"
        >
            <div className="flex flex-col min-h-screen">
                <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    {/* Breadcrumbs */}
                    <nav aria-label={t(lang, "terms.breadcrumb.aria")} className="flex mb-10">
                        <ol className="flex items-center space-x-2">
                            <li>
                                <Link
                                    className="text-text-sub hover:text-primary transition-colors text-sm font-medium"
                                    href={localizePath("/", lang)}
                                >
                                    {t(lang, "terms.breadcrumb.home")}
                                </Link>
                            </li>
                            <li className="text-gray-300">/</li>
                            <li className="text-text-main font-bold text-sm">
                                {t(lang, "terms.breadcrumb.current")}
                            </li>
                        </ol>
                    </nav>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                        {/* Sidebar */}
                        <aside className="lg:col-span-3">
                            <div className="sticky top-24 space-y-8">
                                <div>
                                    <h3 className="font-bold text-lg mb-4 text-text-main dark:text-white px-2">
                                        {t(lang, "terms.sidebar.title")}
                                    </h3>
                                    <nav className="flex flex-col space-y-1">
                                        <Link
                                            className="flex items-center gap-3 px-4 py-2 bg-primary/5 text-primary rounded-lg font-bold transition-colors"
                                            href={localizePath("/terms-of-use", lang)}
                                        >
                                            {t(lang, "terms.sidebar.terms")}
                                        </Link>
                                        <Link
                                            className="flex items-center gap-3 px-4 py-2 text-text-sub dark:text-gray-400 hover:text-text-main dark:hover:text-white rounded-lg font-medium transition-colors"
                                            href={localizePath("/privacy-policy", lang)}
                                        >
                                            {t(lang, "terms.sidebar.privacy")}
                                        </Link>
                                        <Link
                                            className="flex items-center gap-3 px-4 py-2 text-text-sub dark:text-gray-400 hover:text-text-main dark:hover:text-white rounded-lg font-medium transition-colors"
                                            href={localizePath("/terms-of-use", lang)}
                                        >
                                            {t(lang, "terms.sidebar.contentGuidelines")}
                                        </Link>
                                        <Link
                                            className="flex items-center gap-3 px-4 py-2 text-text-sub dark:text-gray-400 hover:text-text-main dark:hover:text-white rounded-lg font-medium transition-colors"
                                            href={localizePath("/privacy-policy", lang)}
                                        >
                                            {t(lang, "terms.sidebar.cookiePolicy")}
                                        </Link>
                                    </nav>
                                </div>

                                <div className="bg-gray-50 dark:bg-surface-dark rounded-2xl p-6">
                                    <p className="text-sm text-text-sub dark:text-gray-400 mb-3 font-medium">
                                        {t(lang, "terms.sidebar.help")}
                                    </p>
                                    <Link
                                        className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
                                        href={localizePath("/contact", lang)}
                                    >
                                        {t(lang, "terms.sidebar.contactSupport")}
                                    </Link>
                                </div>
                            </div>
                        </aside>

                        {/* Content */}
                        <div className="lg:col-span-9">
                            <div className="mb-12 border-b border-gray-100 dark:border-gray-800 pb-8">
                                <span className="inline-block px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold uppercase tracking-wide mb-4">
                                    {t(lang, "terms.header.status")}
                                </span>
                                <h1 className="text-4xl md:text-5xl font-black text-text-main dark:text-white tracking-tight mb-6 leading-tight">
                                    {t(lang, "terms.header.title")}
                                </h1>
                                <p className="text-xl text-text-sub dark:text-gray-400 leading-relaxed max-w-3xl">
                                    {t(lang, "terms.header.subtitle")}
                                </p>
                            </div>

                            <article className="prose prose-lg prose-slate dark:prose-invert max-w-none">
                                <h2 className="flex items-center gap-3">
                                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">1</span>
                                    {t(lang, "terms.section1.title")}
                                </h2>
                                <p>
                                    {t(lang, "terms.section1.body1")}
                                </p>
                                <p>
                                    {t(lang, "terms.section1.body2")}
                                </p>

                                <h2 className="flex items-center gap-3">
                                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">2</span>
                                    {t(lang, "terms.section2.title")}
                                </h2>
                                <p>
                                    {t(lang, "terms.section2.body")}
                                </p>
                                <ul>
                                    <li>{t(lang, "terms.section2.item1")}</li>
                                    <li>{t(lang, "terms.section2.item2")}</li>
                                    <li>{t(lang, "terms.section2.item3")}</li>
                                </ul>

                                <h2 className="flex items-center gap-3">
                                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">3</span>
                                    {t(lang, "terms.section3.title")}
                                </h2>
                                <p>
                                    {t(lang, "terms.section3.body1")}
                                </p>
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl not-prose my-8">
                                    <p className="text-base text-slate-700 dark:text-slate-300 font-medium">
                                        <strong className="text-blue-700 dark:text-blue-400 block mb-1">{t(lang, "terms.section3.note.label")}</strong>
                                        {t(lang, "terms.section3.note.bodyPrefix")}{" "}
                                        <Link
                                            className="text-primary hover:underline"
                                            href={localizePath("/terms-of-use", lang)}
                                        >
                                            {t(lang, "terms.section3.note.link")}
                                        </Link>
                                        {t(lang, "terms.section3.note.bodySuffix")}
                                    </p>
                                </div>
                                <p>
                                    {t(lang, "terms.section3.body2")}
                                </p>

                                <h2 className="flex items-center gap-3">
                                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">4</span>
                                    {t(lang, "terms.section4.title")}
                                </h2>
                                <p>
                                    {t(lang, "terms.section4.body")}
                                </p>

                                <h2 className="flex items-center gap-3">
                                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">5</span>
                                    {t(lang, "terms.section5.title")}
                                </h2>
                                <p>
                                    {t(lang, "terms.section5.body")}
                                </p>
                            </article>

                            <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-800">
                                <h3 className="text-2xl font-bold text-text-main dark:text-white mb-4">
                                    {t(lang, "terms.contact.title")}
                                </h3>
                                <p className="text-lg text-text-sub dark:text-gray-400 mb-8">
                                    {t(lang, "terms.contact.body")}
                                </p>
                                <div className="flex flex-wrap gap-4">
                                    <a
                                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl font-bold transition-all active-press"
                                        href="mailto:support@userreview.net"
                                    >
                                        <span className="material-symbols-outlined">mail</span>
                                        support@userreview.net
                                    </a>
                                    <Link
                                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white hover:bg-primary-dark rounded-xl font-bold transition-all active-press shadow-lg shadow-primary/20"
                                        href={localizePath("/contact", lang)}
                                    >
                                        <span className="material-symbols-outlined">support_agent</span>
                                        {t(lang, "terms.contact.support")}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export async function generateMetadata(
    props: TermsPageProps
): Promise<Metadata> {
    const params = await props.params;
    const lang = normalizeLanguage(params.lang);
    return buildMetadata({
        title: t(lang, "terms.meta.title"),
        description: t(lang, "terms.meta.description"),
        path: "/terms-of-use",
        lang,
        type: "website",
    });
}
