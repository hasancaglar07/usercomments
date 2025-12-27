"use client";

import { useEffect, useState } from "react";
type Heading = {
    id: string;
    text: string;
    level: number;
};

export default function TableOfContents({
    contentSelector = ".prose",
    titleLabel = "Contents",
}: {
    contentSelector?: string;
    titleLabel?: string;
}) {
    const [headings, setHeadings] = useState<Heading[]>([]);
    const [activeId, setActiveId] = useState<string>("");

    useEffect(() => {
        const elements = Array.from(document.querySelectorAll(`${contentSelector} h2, ${contentSelector} h3`));
        const items: Heading[] = elements.map((element, index) => {
            if (!element.id) {
                element.id = `heading-${index}`;
            }
            return {
                id: element.id,
                text: element.textContent ?? "",
                level: Number(element.tagName.substring(1)),
            };
        });
        setHeadings(items);

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                    }
                });
            },
            { rootMargin: "0px 0px -40% 0px" }
        );

        elements.forEach((elem) => observer.observe(elem));
        return () => observer.disconnect();
    }, [contentSelector]);

    if (headings.length < 2) return null;

    return (
        <div className="hidden lg:block sticky top-24 self-start max-w-[240px]">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                    {titleLabel}
                </h3>
                <nav className="flex flex-col gap-1">
                    {headings.map((heading) => (
                        <a
                            key={heading.id}
                            href={`#${heading.id}`}
                            onClick={(e) => {
                                e.preventDefault();
                                document.getElementById(heading.id)?.scrollIntoView({
                                    behavior: "smooth",
                                });
                                setActiveId(heading.id);
                            }}
                            className={`text-sm py-1 border-l-2 pl-3 transition-all ${activeId === heading.id
                                ? "border-primary text-primary font-medium"
                                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                                } ${heading.level === 3 ? "ml-2" : ""}`}
                        >
                            {heading.text}
                        </a>
                    ))}
                </nav>
            </div>
        </div>
    );
}
