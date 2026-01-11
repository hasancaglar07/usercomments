"use client";

import Link from "next/link";
import { localizePath } from "@/src/lib/i18n";

export type BreadcrumbItem = {
    label: string;
    href?: string;
};

type BreadcrumbProps = {
    items: BreadcrumbItem[];
    lang: string;
};

export default function Breadcrumb({ items, lang }: BreadcrumbProps) {
    if (!items || items.length === 0) return null;

    // Add structured data for SEO
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.label,
            item: item.href ? `https://userreview.net${item.href}` : undefined,
        })),
    };

    return (
        <nav aria-label="Breadcrumb" className="w-full">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ol className="flex items-center flex-wrap gap-1 text-sm text-gray-500 dark:text-gray-400">
                <li>
                    <Link
                        href={localizePath("/", lang)}
                        className="flex items-center hover:text-primary transition-colors active-press"
                    >
                        <span className="material-symbols-outlined text-[18px]">home</span>
                    </Link>
                </li>
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;

                    return (
                        <li key={index} className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px] text-gray-400">chevron_right</span>
                            {item.href && !isLast ? (
                                <Link
                                    href={item.href}
                                    className="hover:text-primary transition-colors font-medium active-press"
                                >
                                    {item.label}
                                </Link>
                            ) : (
                                <span className={`truncate max-w-[150px] sm:max-w-xs ${isLast ? "text-gray-900 dark:text-gray-100 font-semibold" : ""}`}>
                                    {item.label}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
