import Link from "next/link";
import type { Metadata } from "next";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { buildMetadata } from "@/src/lib/seo";
import { t } from "@/src/lib/copy";

export const revalidate = 86400;

type PrivacyPolicyPageProps = {
    params: Promise<{ lang: string }>;
};

function splitLabel(value: string) {
    const [label, ...rest] = value.split(":");
    return { label: label.trim(), body: rest.join(":").trim() };
}

export default async function Page(props: PrivacyPolicyPageProps) {
    const params = await props.params;
    const lang = normalizeLanguage(params.lang);
    const personalItem = splitLabel(
        t(lang, "privacy.section.dataCollection.item.personal")
    );
    const contentItem = splitLabel(
        t(lang, "privacy.section.dataCollection.item.content")
    );
    const communicationsItem = splitLabel(
        t(lang, "privacy.section.dataCollection.item.communications")
    );
    const rightsAccessItem = splitLabel(
        t(lang, "privacy.section.rights.item.access")
    );
    const rightsRectificationItem = splitLabel(
        t(lang, "privacy.section.rights.item.rectification")
    );
    const rightsErasureItem = splitLabel(
        t(lang, "privacy.section.rights.item.erasure")
    );
    const cookiesNote = splitLabel(t(lang, "privacy.section.cookies.note"));
    return (
        <div
            className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden"
            data-page="privacy-policy"
        >
            <div className="flex flex-col min-h-screen">
                {/* Main Layout */}
                <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Breadcrumbs */}
                    <nav
                        aria-label={t(lang, "privacy.breadcrumb.aria")}
                        className="flex mb-8 text-sm"
                    >
                        <ol className="inline-flex items-center space-x-2">
                            <li className="inline-flex items-center">
                                <Link
                                    className="text-slate-500 hover:text-primary dark:text-slate-400"
                                    href={localizePath("/", lang)}
                                >
                                    {t(lang, "privacy.breadcrumb.home")}
                                </Link>
                            </li>
                            <li className="text-slate-400">/</li>
                            <li className="inline-flex items-center">
                                <Link
                                    className="text-slate-500 hover:text-primary dark:text-slate-400"
                                    href={localizePath("/terms-of-use", lang)}
                                >
                                    {t(lang, "privacy.breadcrumb.legal")}
                                </Link>
                            </li>
                            <li className="text-slate-400">/</li>
                            <li className="inline-flex items-center">
                                <span className="text-slate-900 font-medium dark:text-slate-100">
                                    {t(lang, "privacy.breadcrumb.current")}
                                </span>
                            </li>
                        </ol>
                    </nav>

                    <div className="flex flex-col lg:flex-row gap-10">
                        {/* Sidebar Navigation (Sticky) */}
                        <aside className="w-full lg:w-64 flex-shrink-0">
                            <div className="sticky top-24 lg:max-h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar">
                                <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 px-2">
                                        {t(lang, "privacy.sidebar.title")}
                                    </h3>
                                    <nav className="flex flex-col space-y-1">
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-md"
                                            href="#introduction"
                                        >
                                            {t(lang, "privacy.sidebar.introduction")}
                                        </Link>
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors"
                                            href="#data-collection"
                                        >
                                            {t(lang, "privacy.sidebar.dataCollection")}
                                        </Link>
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors"
                                            href="#cookies"
                                        >
                                            {t(lang, "privacy.sidebar.cookies")}
                                        </Link>
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors"
                                            href="#data-usage"
                                        >
                                            {t(lang, "privacy.sidebar.dataUsage")}
                                        </Link>
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors"
                                            href="#third-party"
                                        >
                                            {t(lang, "privacy.sidebar.thirdParty")}
                                        </Link>
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors"
                                            href="#user-rights"
                                        >
                                            {t(lang, "privacy.sidebar.rights")}
                                        </Link>
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors"
                                            href="#contact"
                                        >
                                            {t(lang, "privacy.sidebar.contact")}
                                        </Link>
                                    </nav>
                                </div>
                                {/* CTA Box */}
                                <div className="mt-6 p-5 bg-gradient-to-br from-primary to-[#4BA3FF] rounded-xl text-white shadow-lg">
                                    <span className="material-symbols-outlined text-3xl mb-2">
                                        shield_person
                                    </span>
                                    <p className="text-sm font-medium mb-3 opacity-90">
                                        {t(lang, "privacy.sidebar.cta.title")}
                                    </p>
                                    <Link
                                        className="inline-block w-full text-center py-2 px-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-bold transition-colors"
                                        href={localizePath("/contact", lang)}
                                    >
                                        {t(lang, "privacy.sidebar.cta.button")}
                                    </Link>
                                </div>
                            </div>
                        </aside>

                        {/* Content Area */}
                        <article className="flex-1 min-w-0">
                            <div className="bg-white dark:bg-[#1a2632] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 md:p-12">
                                {/* Page Header */}
                                <div className="border-b border-slate-100 dark:border-slate-700 pb-8 mb-10">
                                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                                        {t(lang, "privacy.header.title")}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[18px]">
                                                calendar_today
                                            </span>
                                            {t(lang, "privacy.header.updated")}
                                        </span>
                                        <span className="hidden sm:inline text-slate-300">|</span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[18px]">
                                                schedule
                                            </span>
                                            {t(lang, "privacy.header.readTime")}
                                        </span>
                                    </div>
                                </div>

                                {/* Text Content */}
                                <div className="prose prose-slate dark:prose-invert max-w-none space-y-12">
                                    <section className="scroll-mt-28" id="introduction">
                                        <p className="text-lg leading-8 text-slate-600 dark:text-slate-300">
                                            {t(lang, "privacy.section.intro.body")}
                                        </p>
                                    </section>

                                    <section className="scroll-mt-28" id="data-collection">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                            <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                                                <span className="material-symbols-outlined">dataset</span>
                                            </span>
                                            {t(lang, "privacy.section.dataCollection.title")}
                                        </h2>
                                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                                            {t(lang, "privacy.section.dataCollection.body")}
                                        </p>
                                        <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300 marker:text-primary">
                                            <li>
                                                <strong>{personalItem.label}:</strong> {personalItem.body}
                                            </li>
                                            <li>
                                                <strong>{contentItem.label}:</strong> {contentItem.body}
                                            </li>
                                            <li>
                                                <strong>{communicationsItem.label}:</strong> {communicationsItem.body}
                                            </li>
                                        </ul>
                                    </section>

                                    <section className="scroll-mt-28" id="cookies">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                            <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                                                <span className="material-symbols-outlined">cookie</span>
                                            </span>
                                            {t(lang, "privacy.section.cookies.title")}
                                        </h2>
                                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                                            {t(lang, "privacy.section.cookies.body")}
                                        </p>
                                        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary p-4 rounded-r-lg my-6">
                                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                                <strong>{cookiesNote.label}:</strong> {cookiesNote.body}
                                            </p>
                                        </div>
                                    </section>

                                    <section className="scroll-mt-28" id="data-usage">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                            <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                                                <span className="material-symbols-outlined">analytics</span>
                                            </span>
                                            {t(lang, "privacy.section.dataUsage.title")}
                                        </h2>
                                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                                            {t(lang, "privacy.section.dataUsage.body")}
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                                                    {t(lang, "privacy.section.dataUsage.card.service.title")}
                                                </h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                                    {t(lang, "privacy.section.dataUsage.card.service.body")}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                                                    {t(lang, "privacy.section.dataUsage.card.personalization.title")}
                                                </h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                                    {t(lang, "privacy.section.dataUsage.card.personalization.body")}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                                                    {t(lang, "privacy.section.dataUsage.card.communication.title")}
                                                </h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                                    {t(lang, "privacy.section.dataUsage.card.communication.body")}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                                                    {t(lang, "privacy.section.dataUsage.card.security.title")}
                                                </h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                                    {t(lang, "privacy.section.dataUsage.card.security.body")}
                                                </p>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="scroll-mt-28" id="third-party">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                            <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                                                <span className="material-symbols-outlined">share</span>
                                            </span>
                                            {t(lang, "privacy.section.thirdParty.title")}
                                        </h2>
                                        <p className="text-slate-600 dark:text-slate-300">
                                            {t(lang, "privacy.section.thirdParty.body")}
                                        </p>
                                    </section>

                                    <section className="scroll-mt-28" id="user-rights">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                            <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                                                <span className="material-symbols-outlined">gavel</span>
                                            </span>
                                            {t(lang, "privacy.section.rights.title")}
                                        </h2>
                                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                                            {t(lang, "privacy.section.rights.body")}
                                        </p>
                                        <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300 marker:text-primary mb-6">
                                            <li>
                                                <strong>{rightsAccessItem.label}:</strong> {rightsAccessItem.body}
                                            </li>
                                            <li>
                                                <strong>{rightsRectificationItem.label}:</strong> {rightsRectificationItem.body}
                                            </li>
                                            <li>
                                                <strong>{rightsErasureItem.label}:</strong> {rightsErasureItem.body}
                                            </li>
                                        </ul>
                                        <p className="text-slate-600 dark:text-slate-300">
                                            {t(lang, "privacy.section.rights.footer")}
                                        </p>
                                    </section>

                                    <section className="scroll-mt-28 border-t border-slate-100 dark:border-slate-700 pt-8" id="contact">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                                            {t(lang, "privacy.section.contact.title")}
                                        </h2>
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start">
                                            <div className="flex-1">
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                                    {t(lang, "privacy.section.contact.general.title")}
                                                </h4>
                                                <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                                                    {t(lang, "privacy.section.contact.general.body")}
                                                </p>
                                                <a
                                                    className="inline-flex items-center gap-2 text-primary hover:text-blue-600 font-semibold transition-colors"
                                                    href="mailto:support@userreview.net"
                                                >
                                                    <span className="material-symbols-outlined text-lg">mail</span>
                                                    support@userreview.net
                                                </a>
                                            </div>
                                            <div className="hidden md:block w-px h-24 bg-slate-200 dark:bg-slate-700"></div>
                                            <div className="flex-1">
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                                    {t(lang, "privacy.section.contact.mailing.title")}
                                                </h4>
                                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                                    {t(lang, "privacy.section.contact.mailing.line1")}<br />
                                                    {t(lang, "privacy.section.contact.mailing.line2")}<br />
                                                    {t(lang, "privacy.section.contact.mailing.line3")}
                                                </p>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </article>
                    </div>
                </main>
            </div>
        </div>
    );
}

export async function generateMetadata(
    props: PrivacyPolicyPageProps
): Promise<Metadata> {
    const params = await props.params;
    const lang = normalizeLanguage(params.lang);
    return buildMetadata({
        title: t(lang, "privacy.meta.title"),
        description: t(lang, "privacy.meta.description"),
        path: "/privacy-policy",
        lang,
        type: "website",
    });
}
