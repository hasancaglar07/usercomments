export const runtime = 'edge';

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
        <div className="min-h-screen bg-white dark:bg-background-dark font-sans text-text-main" data-page="privacy-policy">
            <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Breadcrumbs */}
                <nav aria-label="Breadcrumb" className="mb-12">
                    <ol className="flex items-center space-x-2 text-sm text-text-muted">
                        <li>
                            <Link href={localizePath("/", lang)} className="hover:text-primary transition-colors">
                                {t(lang, "privacy.breadcrumb.home")}
                            </Link>
                        </li>
                        <li className="text-gray-300">/</li>
                        <li className="font-medium text-text-main dark:text-white">
                            {t(lang, "privacy.breadcrumb.current")}
                        </li>
                    </ol>
                </nav>

                <div className="flex flex-col lg:flex-row gap-16">
                    {/* Sidebar Navigation */}
                    <aside className="hidden lg:block w-72 flex-shrink-0">
                        <div className="sticky top-12">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-6 pl-3">
                                {t(lang, "privacy.sidebar.title")}
                            </h3>
                            <nav className="flex flex-col space-y-1">
                                {[
                                    { href: "#introduction", label: t(lang, "privacy.sidebar.introduction") },
                                    { href: "#data-collection", label: t(lang, "privacy.sidebar.dataCollection") },
                                    { href: "#cookies", label: t(lang, "privacy.sidebar.cookies") },
                                    { href: "#data-usage", label: t(lang, "privacy.sidebar.dataUsage") },
                                    { href: "#third-party", label: t(lang, "privacy.sidebar.thirdParty") },
                                    { href: "#user-rights", label: t(lang, "privacy.sidebar.rights") },
                                    { href: "#contact", label: t(lang, "privacy.sidebar.contact") },
                                ].map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="block px-4 py-2 text-sm font-medium text-text-sub dark:text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>

                            <div className="mt-10 p-6 bg-gray-50 dark:bg-surface-dark rounded-2xl">
                                <p className="text-sm font-medium mb-4 text-text-main dark:text-white">
                                    {t(lang, "privacy.sidebar.cta.title")}
                                </p>
                                <Link
                                    href={localizePath("/contact", lang)}
                                    className="block w-full text-center py-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-bold shadow-sm hover:shadow dark:text-white transition-all"
                                >
                                    {t(lang, "privacy.sidebar.cta.button")}
                                </Link>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <article className="flex-1 min-w-0 prose prose-lg prose-slate dark:prose-invert max-w-4xl">
                        <header className="mb-16 not-prose">
                            <h1 className="text-4xl md:text-6xl font-black text-text-main dark:text-white tracking-tight mb-6">
                                {t(lang, "privacy.header.title")}
                            </h1>
                            <p className="text-xl text-text-sub dark:text-gray-400 leading-relaxed">
                                {t(lang, "privacy.section.intro.body")}
                            </p>
                        </header>

                        <div className="space-y-16">
                            <section id="data-collection" className="scroll-mt-32">
                                <div className="flex items-center gap-4 mb-6">
                                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">1</span>
                                    <h2 className="text-3xl font-bold text-text-main dark:text-white m-0">
                                        {t(lang, "privacy.section.dataCollection.title")}
                                    </h2>
                                </div>
                                <p className="text-text-sub dark:text-gray-300">
                                    {t(lang, "privacy.section.dataCollection.body")}
                                </p>
                                <ul className="mt-6 space-y-4 list-none pl-0">
                                    {[personalItem, contentItem, communicationsItem].map((item, idx) => (
                                        <li key={idx} className="flex gap-4 p-4 rounded-xl bg-gray-50 dark:bg-surface-dark/50">
                                            <div className="size-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                                            <div>
                                                <strong className="block text-text-main dark:text-white mb-1">{item.label}</strong>
                                                <span className="text-text-muted">{item.body}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            <section id="cookies" className="scroll-mt-32">
                                <div className="flex items-center gap-4 mb-6">
                                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">2</span>
                                    <h2 className="text-3xl font-bold text-text-main dark:text-white m-0">
                                        {t(lang, "privacy.section.cookies.title")}
                                    </h2>
                                </div>
                                <p className="text-text-sub dark:text-gray-300">
                                    {t(lang, "privacy.section.cookies.body")}
                                </p>
                                <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                    <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2 not-prose">{cookiesNote.label}</h4>
                                    <p className="text-blue-800 dark:text-blue-200 text-sm m-0 not-prose leading-relaxed">
                                        {cookiesNote.body}
                                    </p>
                                </div>
                            </section>

                            <section id="data-usage" className="scroll-mt-32">
                                <div className="flex items-center gap-4 mb-6">
                                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">3</span>
                                    <h2 className="text-3xl font-bold text-text-main dark:text-white m-0">
                                        {t(lang, "privacy.section.dataUsage.title")}
                                    </h2>
                                </div>
                                <p className="text-text-sub dark:text-gray-300">
                                    {t(lang, "privacy.section.dataUsage.body")}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 not-prose">
                                    {[
                                        { title: "privacy.section.dataUsage.card.service.title", body: "privacy.section.dataUsage.card.service.body" },
                                        { title: "privacy.section.dataUsage.card.personalization.title", body: "privacy.section.dataUsage.card.personalization.body" },
                                        { title: "privacy.section.dataUsage.card.communication.title", body: "privacy.section.dataUsage.card.communication.body" },
                                        { title: "privacy.section.dataUsage.card.security.title", body: "privacy.section.dataUsage.card.security.body" }
                                    ].map((card, idx) => (
                                        <div key={idx} className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-primary/50 transition-colors">
                                            <h4 className="font-bold text-text-main dark:text-white mb-2">
                                                {t(lang, card.title)}
                                            </h4>
                                            <p className="text-sm text-text-muted">
                                                {t(lang, card.body)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section id="third-party" className="scroll-mt-32">
                                <div className="flex items-center gap-4 mb-6">
                                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">4</span>
                                    <h2 className="text-3xl font-bold text-text-main dark:text-white m-0">
                                        {t(lang, "privacy.section.thirdParty.title")}
                                    </h2>
                                </div>
                                <p className="text-text-sub dark:text-gray-300">
                                    {t(lang, "privacy.section.thirdParty.body")}
                                </p>
                            </section>

                            <section id="user-rights" className="scroll-mt-32">
                                <div className="flex items-center gap-4 mb-6">
                                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">5</span>
                                    <h2 className="text-3xl font-bold text-text-main dark:text-white m-0">
                                        {t(lang, "privacy.section.rights.title")}
                                    </h2>
                                </div>
                                <p className="text-text-sub dark:text-gray-300 mb-6">
                                    {t(lang, "privacy.section.rights.body")}
                                </p>
                                <div className="space-y-4">
                                    {[rightsAccessItem, rightsRectificationItem, rightsErasureItem].map((item, idx) => (
                                        <div key={idx} className="pl-6 border-l-2 border-gray-200 dark:border-gray-700">
                                            <h4 className="font-bold text-text-main dark:text-white text-lg m-0 mb-2">{item.label}</h4>
                                            <p className="text-text-muted m-0">{item.body}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-text-sub dark:text-gray-400 mt-8 italic text-sm">
                                    {t(lang, "privacy.section.rights.footer")}
                                </p>
                            </section>

                            <section id="contact" className="scroll-mt-32 pt-12 border-t border-gray-100 dark:border-gray-800">
                                <div className="bg-gray-50 dark:bg-surface-dark rounded-3xl p-8 md:p-12 text-center">
                                    <h2 className="text-3xl font-black text-text-main dark:text-white mb-4 m-0">
                                        {t(lang, "privacy.section.contact.title")}
                                    </h2>
                                    <p className="text-text-sub mb-8 max-w-2xl mx-auto">
                                        {t(lang, "privacy.section.contact.general.body")}
                                    </p>
                                    <a
                                        href="mailto:support@userreview.net"
                                        className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-full hover:bg-primary-dark transition-all shadow-lg shadow-primary/30"
                                    >
                                        <span className="material-symbols-outlined">mail</span>
                                        support@userreview.net
                                    </a>

                                    <div className="mt-12 text-sm text-text-muted">
                                        <p className="font-bold text-text-main dark:text-white uppercase tracking-wide mb-2">
                                            {t(lang, "privacy.section.contact.mailing.title")}
                                        </p>
                                        <p>
                                            {t(lang, "privacy.section.contact.mailing.line1")}<br />
                                            {t(lang, "privacy.section.contact.mailing.line2")}<br />
                                            {t(lang, "privacy.section.contact.mailing.line3")}
                                        </p>
                                    </div>
                                </div>
                            </section>

                        </div>
                    </article>
                </div>
            </main>
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
