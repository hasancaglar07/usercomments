import Link from "next/link";
import type { ReviewCardHomepageData } from "@/components/cards/ReviewCard";
import ReviewCardTrending from "@/components/cards/ReviewCardTrending";
import { t } from "@/src/lib/copy";
import type { SupportedLanguage } from "@/src/lib/i18n";
import { localizePath } from "@/src/lib/i18n";

// Note: This must match the type used in page.tsx
type TrendingTab = "popular" | "popular6h" | "popular24h" | "popular1w" | "latest" | "rating";

type TrendingSectionProps = {
    lang: SupportedLanguage;
    initialTab: TrendingTab;
    initialData: ReviewCardHomepageData[];
    activeFilter?: string;
};

const TRENDING_TABS = [
    { key: "popular6h", labelKey: "homepage.trendingTabs.popular6h" },
    { key: "popular24h", labelKey: "homepage.trendingTabs.popular24h" },
    { key: "popular1w", labelKey: "homepage.trendingTabs.popular1w" },
    { key: "popular", labelKey: "homepage.trendingTabs.popular" },
    // { key: "latest", labelKey: "homepage.trendingTabs.latest" },
    // { key: "rating", labelKey: "homepage.trendingTabs.rating" },
] as const;

export default function TrendingSection({
    lang,
    initialTab,
    initialData,
    activeFilter,
}: TrendingSectionProps) {
    const activeTab = initialTab;
    const currentCards = initialData;
    const basePath = localizePath("/", lang);

    return (
        <section className="mb-4 sm:mb-10">
            <div className="flex items-center gap-2 sm:justify-between sm:gap-x-4 mb-1 sm:mb-8 overflow-hidden">
                <h1 className="flex text-sm sm:text-3xl font-black tracking-tight text-text-main dark:text-white items-center gap-2 sm:gap-3 shrink-0 whitespace-nowrap">
                    {t(lang, "homepage.heroHeading") || t(lang, "homepage.trendingTitle")}
                </h1>

                <div className="flex flex-1 sm:flex-none gap-2 p-1 overflow-x-auto no-scrollbar sm:flex-wrap">
                    {TRENDING_TABS.map((tab) => {
                        const isActive = tab.key === activeTab;
                        const params = new URLSearchParams();
                        if (activeFilter) {
                            params.set("filter", activeFilter);
                        }
                        params.set("trending", tab.key);
                        const query = params.toString();
                        const href = query ? `${basePath}?${query}` : basePath;
                        return (
                            <Link
                                key={tab.key}
                                href={href}
                                prefetch={false}
                                className={
                                    isActive
                                        ? "px-5 py-2.5 sm:px-6 sm:py-3 text-sm font-bold rounded-full bg-primary text-white transition-colors whitespace-nowrap shrink-0 shadow-sm"
                                        : "px-5 py-2.5 sm:px-6 sm:py-3 text-sm font-bold rounded-full text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors whitespace-nowrap shrink-0"

                                }
                            >
                                {t(lang, tab.labelKey)}
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className="min-h-[300px]">
                {currentCards.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-12 text-center">
                        <div className="inline-flex p-4 rounded-full bg-gray-50 dark:bg-gray-800 mb-4 text-text-muted">
                            <span className="material-symbols-outlined text-[32px]">sentiment_dissatisfied</span>
                        </div>
                        <p className="text-text-muted font-medium">{t(lang, "homepage.trendingEmpty")}</p>
                    </div>
                ) : (
                    <div
                        key={activeTab}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                        {currentCards.map((card, index) => (
                            <div
                                key={`trending-wrapper-${activeTab}-${index}`}
                                className={`h-full ${index === 0 ? "opacity-100" : "opacity-0 animate-fade-in"}`}
                                style={index === 0 ? undefined : { animationDelay: `${index * 100}ms` }}
                            >
                                <ReviewCardTrending
                                    {...card}
                                    lang={lang}
                                    imagePriority={index < 3}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
