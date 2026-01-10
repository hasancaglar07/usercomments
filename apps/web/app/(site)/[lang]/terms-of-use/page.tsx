import Link from "next/link";
import type { Metadata } from "next";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { buildMetadata } from "@/src/lib/seo";
import { t } from "@/src/lib/copy";

export const runtime = 'edge';
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
                {/* Main Content Area */}
                <main className="flex-grow w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Breadcrumbs */}
                    <nav aria-label={t(lang, "terms.breadcrumb.aria")} className="flex mb-8">
                        <ol className="flex items-center space-x-2">
                            <li>
                                <Link
                                    className="text-slate-500 hover:text-primary transition-colors text-sm font-medium"
                                    href={localizePath("/", lang)}
                                >
                                    {t(lang, "terms.breadcrumb.home")}
                                </Link>
                            </li>
                            <li>
                                <span className="text-slate-400 text-sm">/</span>
                            </li>
                            <li>
                                <Link
                                    className="text-slate-500 hover:text-primary transition-colors text-sm font-medium"
                                    href={localizePath("/terms-of-use", lang)}
                                >
                                    {t(lang, "terms.breadcrumb.legal")}
                                </Link>
                            </li>
                            <li>
                                <span className="text-slate-400 text-sm">/</span>
                            </li>
                            <li>
                                <span
                                    aria-current="page"
                                    className="text-slate-900 dark:text-white text-sm font-semibold"
                                >
                                    {t(lang, "terms.breadcrumb.current")}
                                </span>
                            </li>
                        </ol>
                    </nav>

                    <div className="flex flex-col lg:flex-row gap-8 xl:gap-12">
                        {/* Sidebar Navigation */}
                        <aside className="w-full lg:w-64 flex-shrink-0">
                            <div className="sticky top-24 bg-white dark:bg-[#1a2634] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                    <h3 className="text-slate-900 dark:text-white font-bold text-sm uppercase tracking-wider">
                                        {t(lang, "terms.sidebar.title")}
                                    </h3>
                                </div>
                                <nav className="flex flex-col p-2 space-y-1">
                                    <Link
                                        className="flex items-center gap-3 px-3 py-2.5 bg-primary/10 text-primary rounded-lg font-medium transition-colors"
                                        href={localizePath("/terms-of-use", lang)}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            gavel
                                        </span>
                                        <span className="text-sm">{t(lang, "terms.sidebar.terms")}</span>
                                    </Link>
                                    <Link
                                        className="flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg font-medium transition-colors"
                                        href={localizePath("/privacy-policy", lang)}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            lock
                                        </span>
                                        <span className="text-sm">{t(lang, "terms.sidebar.privacy")}</span>
                                    </Link>
                                    <Link
                                        className="flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg font-medium transition-colors"
                                        href={localizePath("/terms-of-use", lang)}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            description
                                        </span>
                                        <span className="text-sm">{t(lang, "terms.sidebar.contentGuidelines")}</span>
                                    </Link>
                                    <Link
                                        className="flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg font-medium transition-colors"
                                        href={localizePath("/privacy-policy", lang)}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            cookie
                                        </span>
                                        <span className="text-sm">{t(lang, "terms.sidebar.cookiePolicy")}</span>
                                    </Link>
                                    <Link
                                        className="flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg font-medium transition-colors"
                                        href={localizePath("/terms-of-use", lang)}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            copyright
                                        </span>
                                        <span className="text-sm">{t(lang, "terms.sidebar.dmcaNotice")}</span>
                                    </Link>
                                </nav>
                                {/* Mini Contact Card in Sidebar */}
                                <div className="p-4 mt-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 mb-2">
                                        {t(lang, "terms.sidebar.help")}
                                    </p>
                                    <Link
                                        className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
                                        href={localizePath("/contact", lang)}
                                    >
                                        {t(lang, "terms.sidebar.contactSupport")}
                                        <span className="material-symbols-outlined text-[16px]">
                                            arrow_forward
                                        </span>
                                    </Link>
                                </div>
                            </div>
                        </aside>

                        {/* Document Content */}
                        <div className="flex-1 bg-white dark:bg-[#1a2634] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-10 lg:p-12">
                            {/* Header of Document */}
                            <div className="mb-10 border-b border-slate-100 dark:border-slate-700 pb-8">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                        {t(lang, "terms.header.title")}
                                    </h1>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold uppercase tracking-wide border border-green-100 dark:border-green-800">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                        {t(lang, "terms.header.status")}
                                    </div>
                                </div>
                                <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {t(lang, "terms.header.subtitle")}
                                </p>
                                <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[18px]">
                                            calendar_month
                                        </span>
                                        <span>
                                            {t(lang, "terms.header.updatedLabel")}{" "}
                                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                {t(lang, "terms.header.updatedDate")}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-300"></div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[18px]">
                                            schedule
                                        </span>
                                        <span>{t(lang, "terms.header.readTime")}</span>
                                    </div>
                                    <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-300"></div>
                                    <button className="flex items-center gap-1 text-primary hover:text-primary-dark transition-colors font-medium">
                                        <span className="material-symbols-outlined text-[18px]">
                                            print
                                        </span>
                                        <span>{t(lang, "terms.header.print")}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Search within document */}
                            <div className="relative mb-8">
                                <input
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder={t(lang, "terms.searchPlaceholder")}
                                    type="text"
                                />
                                <span className="material-symbols-outlined absolute left-3 top-3.5 text-slate-400">
                                    search
                                </span>
                            </div>

                            {/* Document Body Text */}
                            <article className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-8 flex items-center gap-2">
                                    <span className="flex items-center justify-center size-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-bold">
                                        1
                                    </span>
                                    {t(lang, "terms.section1.title")}
                                </h2>
                                <p className="mb-4">
                                    {t(lang, "terms.section1.body1")}
                                </p>
                                <p className="mb-6">
                                    {t(lang, "terms.section1.body2")}
                                </p>

                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-8 flex items-center gap-2">
                                    <span className="flex items-center justify-center size-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-bold">
                                        2
                                    </span>
                                    {t(lang, "terms.section2.title")}
                                </h2>
                                <p className="mb-4">
                                    {t(lang, "terms.section2.body")}
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mb-6 marker:text-primary">
                                    <li>{t(lang, "terms.section2.item1")}</li>
                                    <li>{t(lang, "terms.section2.item2")}</li>
                                    <li>{t(lang, "terms.section2.item3")}</li>
                                </ul>

                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-8 flex items-center gap-2">
                                    <span className="flex items-center justify-center size-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-bold">
                                        3
                                    </span>
                                    {t(lang, "terms.section3.title")}
                                </h2>
                                <p className="mb-4">
                                    {t(lang, "terms.section3.body1")}
                                </p>
                                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary p-4 rounded-r-lg my-6">
                                    <p className="text-sm text-slate-700 dark:text-slate-300 m-0">
                                        <strong>{t(lang, "terms.section3.note.label")}</strong>{" "}
                                        {t(lang, "terms.section3.note.bodyPrefix")}{" "}
                                        <Link
                                            className="text-primary hover:underline font-medium"
                                            href={localizePath("/terms-of-use", lang)}
                                        >
                                            {t(lang, "terms.section3.note.link")}
                                        </Link>
                                        {t(lang, "terms.section3.note.bodySuffix")}
                                    </p>
                                </div>
                                <p className="mb-6">
                                    {t(lang, "terms.section3.body2")}
                                </p>

                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-8 flex items-center gap-2">
                                    <span className="flex items-center justify-center size-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-bold">
                                        4
                                    </span>
                                    {t(lang, "terms.section4.title")}
                                </h2>
                                <p className="mb-6">
                                    {t(lang, "terms.section4.body")}
                                </p>

                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-8 flex items-center gap-2">
                                    <span className="flex items-center justify-center size-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-bold">
                                        5
                                    </span>
                                    {t(lang, "terms.section5.title")}
                                </h2>
                                <p className="mb-6">
                                    {t(lang, "terms.section5.body")}
                                </p>

                                <hr className="my-10 border-slate-200 dark:border-slate-700" />
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                    {t(lang, "terms.contact.title")}
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400 mb-4">
                                    {t(lang, "terms.contact.body")}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <a
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
                                        href="mailto:support@userreview.net"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            mail
                                        </span>
                                        support@userreview.net
                                    </a>
                                    <Link
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
                                        href={localizePath("/contact", lang)}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            support_agent
                                        </span>
                                        {t(lang, "terms.contact.support")}
                                    </Link>
                                </div>
                            </article>
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
