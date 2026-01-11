"use client";

import { useEffect, useState } from "react";

export default function ScrollToTop() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const toggleVisibility = () => {
            if (window.scrollY > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener("scroll", toggleVisibility);

        return () => window.removeEventListener("scroll", toggleVisibility);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    return (
        <>
            <button
                onClick={scrollToTop}
                className={`fixed bottom-24 right-4 z-40 p-3 rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition-all duration-300 transform active:scale-90 active:shadow-sm hover:scale-110 hover:bg-primary-dark active-press ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
                    }`}
                aria-label="Scroll to top"
            >
                <span className="material-symbols-outlined text-[28px] font-bold">arrow_upward</span>
            </button>
        </>
    );
}
