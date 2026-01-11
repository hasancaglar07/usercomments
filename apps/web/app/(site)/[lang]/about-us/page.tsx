export const runtime = 'edge';

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
        <div className="min-h-screen bg-white dark:bg-background-dark font-sans text-text-main" data-page="about-us">
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                {/* Hero Section */}
                <div className="text-center mb-24 max-w-4xl mx-auto">
                    <h1 className="text-5xl md:text-7xl font-black text-text-main dark:text-white tracking-tight mb-8">
                        {t(lang, "about.hero.title")}
                    </h1>
                    <p className="text-xl md:text-2xl text-text-sub dark:text-gray-400 leading-relaxed max-w-3xl mx-auto font-light">
                        {t(lang, "about.hero.subtitle")}
                    </p>
                </div>

                {/* Mission Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center mb-24">
                    <div>
                        <span className="text-primary font-bold uppercase tracking-widest text-sm mb-2 block">Our Mission</span>
                        <h2 className="text-3xl md:text-4xl font-bold text-text-main dark:text-white mb-6 leading-tight">
                            {t(lang, "about.section.mission.title")}
                        </h2>
                        <p className="text-lg text-text-sub dark:text-gray-300 leading-relaxed">
                            {t(lang, "about.section.mission.body")}
                        </p>
                    </div>
                    <div className="grid gap-6">
                        <div className="p-8 bg-gray-50 dark:bg-surface-dark rounded-3xl transition-transform hover:-translate-y-1 duration-300">
                            <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-[24px]">verified</span>
                            </div>
                            <h3 className="text-xl font-bold text-text-main dark:text-white mb-3">
                                {t(lang, "about.card.authentic.title")}
                            </h3>
                            <p className="text-text-muted">
                                {t(lang, "about.card.authentic.body")}
                            </p>
                        </div>
                        <div className="p-8 bg-gray-50 dark:bg-surface-dark rounded-3xl transition-transform hover:-translate-y-1 duration-300 translate-x-4 md:translate-x-8">
                            <div className="size-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-[24px]">group</span>
                            </div>
                            <h3 className="text-xl font-bold text-text-main dark:text-white mb-3">
                                {t(lang, "about.card.community.title")}
                            </h3>
                            <p className="text-text-muted">
                                {t(lang, "about.card.community.body")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Offer Section */}
                <div className="mb-24">
                    <div className="max-w-3xl">
                        <span className="text-secondary font-bold uppercase tracking-widest text-sm mb-2 block">What We Offer</span>
                        <h2 className="text-3xl md:text-4xl font-bold text-text-main dark:text-white mb-6">
                            {t(lang, "about.section.offer.title")}
                        </h2>
                        <p className="text-lg text-text-sub dark:text-gray-300 mb-10 leading-relaxed">
                            {t(lang, "about.section.offer.body")}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            t(lang, "about.section.offer.item1"),
                            t(lang, "about.section.offer.item2"),
                            t(lang, "about.section.offer.item3"),
                            t(lang, "about.section.offer.item4")
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-start gap-4 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                                <span className="text-primary font-bold text-xl">{(idx + 1).toString().padStart(2, '0')}</span>
                                <p className="font-bold text-text-main dark:text-white">{item}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CTA Section */}
                <div className="bg-text-main dark:bg-surface-dark rounded-3xl p-12 md:p-20 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 size-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 size-96 bg-secondary/20 rounded-full blur-3xl opacity-50" />

                    <div className="relative z-10 max-w-2xl mx-auto">
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
                            {t(lang, "about.cta.title")}
                        </h2>
                        <p className="text-lg text-gray-300 mb-10">
                            {t(lang, "about.cta.body")}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href={localizePath("/node/add/review", lang)}
                                className="px-8 py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/30 hover:-translate-y-1"
                            >
                                {t(lang, "about.cta.primary")}
                            </Link>
                            <Link
                                href={localizePath("/catalog", lang)}
                                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all backdrop-blur-sm border border-white/10 hover:border-white/20"
                            >
                                {t(lang, "about.cta.secondary")}
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
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
