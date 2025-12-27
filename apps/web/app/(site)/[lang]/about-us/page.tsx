import Link from "next/link";
import type { Metadata } from "next";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { buildMetadata } from "@/src/lib/seo";
import { t } from "@/src/lib/copy";

export const revalidate = 86400;

type AboutPageProps = {
    params: Promise<{ lang: string }>;
};

export default async function Page(props: AboutPageProps) {
    const params = await props.params;
    const lang = normalizeLanguage(params.lang);
    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden">
            <div className="flex flex-col min-h-screen">
                <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-16">
                            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-6">
                                {t(lang, "about.hero.title")}
                            </h1>
                            <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
                                {t(lang, "about.hero.subtitle")}
                            </p>
                        </div>

                        <div className="bg-white dark:bg-[#1a2632] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 md:p-12 mb-12">
                            <div className="prose prose-slate dark:prose-invert max-w-none space-y-10">
                                <section>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                                        {t(lang, "about.section.mission.title")}
                                    </h2>
                                    <p className="text-lg text-slate-600 dark:text-slate-300">
                                        {t(lang, "about.section.mission.body")}
                                    </p>
                                </section>

                                <section className="grid md:grid-cols-2 gap-8 my-12">
                                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
                                            <span className="material-symbols-outlined">verified</span>
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">
                                            {t(lang, "about.card.authentic.title")}
                                        </h3>
                                        <p className="text-slate-600 dark:text-slate-400">
                                            {t(lang, "about.card.authentic.body")}
                                        </p>
                                    </div>
                                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
                                            <span className="material-symbols-outlined">group</span>
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">
                                            {t(lang, "about.card.community.title")}
                                        </h3>
                                        <p className="text-slate-600 dark:text-slate-400">
                                            {t(lang, "about.card.community.body")}
                                        </p>
                                    </div>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                                        {t(lang, "about.section.offer.title")}
                                    </h2>
                                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                                        {t(lang, "about.section.offer.body")}
                                    </p>
                                    <ul className="list-disc pl-5 space-y-3 text-slate-600 dark:text-slate-300 marker:text-primary">
                                        <li>{t(lang, "about.section.offer.item1")}</li>
                                        <li>{t(lang, "about.section.offer.item2")}</li>
                                        <li>{t(lang, "about.section.offer.item3")}</li>
                                        <li>{t(lang, "about.section.offer.item4")}</li>
                                    </ul>
                                </section>

                                <section className="bg-slate-900 text-white rounded-2xl p-8 md:p-10 text-center">
                                    <h2 className="text-2xl font-bold mb-4">
                                        {t(lang, "about.cta.title")}
                                    </h2>
                                    <p className="text-slate-400 mb-8">
                                        {t(lang, "about.cta.body")}
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                        <Link
                                            href={localizePath("/node/add/review", lang)}
                                            className="px-8 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg transition-colors"
                                        >
                                            {t(lang, "about.cta.primary")}
                                        </Link>
                                        <Link
                                            href={localizePath("/catalog", lang)}
                                            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition-colors border border-white/10"
                                        >
                                            {t(lang, "about.cta.secondary")}
                                        </Link>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export async function generateMetadata(props: AboutPageProps): Promise<Metadata> {
    const params = await props.params;
    const lang = normalizeLanguage(params.lang);
    return buildMetadata({
        title: t(lang, "about.meta.title"),
        description: t(lang, "about.meta.description"),
        path: "/about-us",
        lang,
        type: "website",
    });
}
