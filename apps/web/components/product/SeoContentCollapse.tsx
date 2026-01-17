"use client";

import { useState, useRef, useEffect } from "react";
import cx from "classnames";
import { ChevronDown, ChevronUp } from "lucide-react";
import { t } from "@/src/lib/copy";

interface SeoContentCollapseProps {
    contentHtml: string;
    lang: string;
    className?: string;
}

export default function SeoContentCollapse({
    contentHtml,
    lang,
    className,
}: SeoContentCollapseProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [shouldShowButton, setShouldShowButton] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (contentRef.current) {
            // If content height is significantly larger than our collapsed height (250px)
            if (contentRef.current.scrollHeight > 280) {
                setShouldShowButton(true);
            }
        }
    }, [contentHtml]);

    if (!contentHtml) return null;

    return (
        <section
            className={cx(
                "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm transition-all duration-500 ease-in-out",
                className
            )}
        >
            <div
                className={cx(
                    "relative overflow-hidden transition-all duration-500 ease-in-out prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300",
                    "prose-headings:text-slate-900 dark:prose-headings:text-white prose-headings:font-bold",
                    "prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4",
                    "prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3",
                    "prose-p:leading-relaxed prose-p:mb-4",
                    !isExpanded && "max-h-[250px]"
                )}
                ref={contentRef}
            >
                <div dangerouslySetInnerHTML={{ __html: contentHtml }} />

                {/* Gradient Mask for collapsed state */}
                {!isExpanded && shouldShowButton && (
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white dark:from-slate-900 to-transparent z-10" />
                )}
            </div>

            {shouldShowButton && (
                <div className="flex justify-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="group flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-primary/10 hover:text-primary transition-all duration-300"
                    >
                        {isExpanded ? (
                            <>
                                <span>{t(lang as any, "common.showLess" as any) || "Daha Az Göster"}</span>
                                <ChevronUp className="w-4 h-4 transition-transform group-hover:-translate-y-1" />
                            </>
                        ) : (
                            <>
                                <span>{t(lang as any, "common.showMore" as any) || "Devamını Oku"}</span>
                                <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-1" />
                            </>
                        )}
                    </button>
                </div>
            )}
        </section>
    );
}
