"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useRef } from "react";
import {
    ReviewCardHomepage,
    type ReviewCardHomepageData,
} from "@/components/cards/ReviewCard";
import { getPopularReviews } from "@/src/lib/api";
import { t } from "@/src/lib/copy";
import { FALLBACK_AVATARS, FALLBACK_REVIEW_IMAGES, buildRatingStars, formatCompactNumber, formatRelativeTime, pickFrom } from "@/src/lib/review-utils";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";
import { localizePath } from "@/src/lib/i18n";
import type { Review } from "@/src/types";
import type { SupportedLanguage } from "@/src/lib/i18n";

// Note: This must match the type used in page.tsx
type TrendingTab = "popular" | "popular6h" | "popular24h" | "popular1w" | "latest" | "rating";

type TrendingSectionProps = {
    lang: SupportedLanguage;
    initialTab: TrendingTab;
    initialData: ReviewCardHomepageData[];
};

const TRENDING_TABS = [
    { key: "popular", labelKey: "homepage.trendingTabs.popular" },
    { key: "popular6h", labelKey: "homepage.trendingTabs.popular6h" },
    { key: "popular24h", labelKey: "homepage.trendingTabs.popular24h" },
    { key: "popular1w", labelKey: "homepage.trendingTabs.popular1w" },
    // { key: "latest", labelKey: "homepage.trendingTabs.latest" },
    // { key: "rating", labelKey: "homepage.trendingTabs.rating" },
] as const;

const ACTIVE_TRENDING_TAB_CLASS =
    "px-4 py-2 text-xs font-bold rounded-full bg-primary text-white shadow-md shadow-primary/25 transition-all transform scale-105";
const INACTIVE_TRENDING_TAB_CLASS =
    "px-4 py-2 text-xs font-bold rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-all hover:border-gray-300 dark:hover:border-gray-600";

// Helper to map tab key to API param
function mapTabToTimeWindow(tab: TrendingTab): "6h" | "24h" | "week" | undefined {
    switch (tab) {
        case "popular6h": return "6h";
        case "popular24h": return "24h";
        case "popular1w": return "week";
        default: return undefined;
    }
}

// Client-side mapper (partial duplication of page.tsx logic, but necessary for client fetching)
function mapReviewToCard(review: Review, lang: string, index: number): ReviewCardHomepageData {
    // Note: We don't have categories here easily unless we fetch them or pass them. 
    // For simplicity/speed, we might omit category name or fetch it.
    // However, the card mostly relies on review data.
    // The "authorMeta" usually contained category name. We'll fallback to "Community Member" or similar if missing,
    // or just display basic meta.
    // Actually, getPopularReviews returns Review objects which have everything except the joined category name if not expanded?
    // The API responses usually include what's needed.
    // Let's assume we can format it decently.

    // Quick fix: The API call `getPopularReviews` returns `Review[]`. 
    // We need to map it to `ReviewCardHomepageData`.

    // We'll use a simplified mapping for client-fetched items if category info is missing
    const relative = formatRelativeTime(review.createdAt, lang);

    return {
        review,
        href: localizePath(`/content/${review.slug}`, lang),
        authorMeta: t(lang, "homepage.reviewerMetaCommunity"), // distinct from "reviewerMetaWithCategory"
        postedLabel: relative
            ? t(lang, "homepage.postedWithRelative", { relative })
            : t(lang, "homepage.postedRecently"),
        ratingStars: buildRatingStars(review.ratingAvg),
        ratingValue: (review.ratingAvg ?? 0).toFixed(1),
        imageUrl: review.photoUrls?.[0] ?? pickFrom(FALLBACK_REVIEW_IMAGES, index),
        imageAlt: review.title,
        avatarUrl: review.author.profilePicUrl ?? pickFrom(FALLBACK_AVATARS, index),
        avatarAlt: t(lang, "homepage.avatarAlt", {
            username: review.author.username,
        }),
        badge: (review.ratingAvg ?? 0) >= 4.5 && (review.ratingCount ?? 0) >= 10 ? "verified" : null,
        likesLabel: formatCompactNumber(review.votesUp ?? 0, lang),
        commentsLabel: formatCompactNumber(review.commentCount ?? 0, lang),
        photoCountLabel:
            review.photoCount && review.photoCount > 0
                ? formatCompactNumber(review.photoCount, lang)
                : undefined,
    };
}


export default function TrendingSection({ lang, initialTab, initialData }: TrendingSectionProps) {
    const [activeTab, setActiveTab] = useState<TrendingTab>(initialTab);
    const [dataCache, setDataCache] = useState<Record<string, ReviewCardHomepageData[]>>({
        [initialTab]: initialData
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleTabChange = async (tab: TrendingTab) => {
        setActiveTab(tab);

        if (dataCache[tab]) {
            return; // Use cached data
        }

        setIsLoading(true);
        try {
            const timeWindow = mapTabToTimeWindow(tab);
            const reviews = await getPopularReviews(3, lang as any, timeWindow); // hardcoded limit 3 matching page.tsx

            const cards = reviews.map((r, i) => mapReviewToCard(r, lang, i));

            setDataCache(prev => ({
                ...prev,
                [tab]: cards
            }));
        } catch (err) {
            console.error("Failed to fetch trending reviews", err);
        } finally {
            setIsLoading(false);
        }
    };

    const currentCards = dataCache[activeTab] || [];
    const showSkeleton = isLoading && !dataCache[activeTab];

    return (
        <section className="mb-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
                <h2 className="text-3xl font-black tracking-tight text-text-main dark:text-white flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-secondary/10 to-primary/10 rounded-xl">
                        <span className="material-symbols-outlined text-secondary" style={{ fontSize: "32px", fontVariationSettings: "'FILL' 1" }}>
                            trending_up
                        </span>
                    </div>
                    {t(lang, "homepage.trendingTitle")}
                </h2>

                <div className="flex flex-wrap gap-2 p-1.5 bg-gray-50/80 dark:bg-gray-800/50 rounded-full border border-gray-100 dark:border-gray-800 backdrop-blur-sm">
                    {TRENDING_TABS.map((tab) => {
                        const isActive = tab.key === activeTab;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                className={
                                    isActive ? ACTIVE_TRENDING_TAB_CLASS : INACTIVE_TRENDING_TAB_CLASS
                                }
                                onClick={() => handleTabChange(tab.key as TrendingTab)}
                            >
                                {t(lang, tab.labelKey)}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="min-h-[300px]">
                {showSkeleton ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-[420px] rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
                        ))}
                    </div>
                ) : (
                    currentCards.length === 0 ? (
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
                                    className="opacity-0 animate-fade-in h-full"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    <ReviewCardHomepage
                                        {...card}
                                        lang={lang as any}
                                        imagePriority={index === 0}
                                        layout="vertical"
                                    />
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </section>
    );
}
