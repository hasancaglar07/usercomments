"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { normalizeLanguage } from "@/src/lib/i18n";

type CookieConsentProps = {
    lang: string;
};

export default function CookieConsent({ lang }: CookieConsentProps) {
    const [show, setShow] = useState(false);
    const resolvedLang = normalizeLanguage(lang);

    useEffect(() => {
        // Check if user has already consented
        const consent = localStorage.getItem("cookie_consent");
        if (!consent) {
            // Small delay for smooth entrance
            const timer = setTimeout(() => setShow(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem("cookie_consent", "true");
        setShow(false);
    };

    if (!show) return null;

    const content = {
        en: {
            text: "We use cookies to improve your experience. By using our site, you agree to our",
            policy: "Cookie Policy",
            button: "Accept",
        },
        tr: {
            text: "Deneyiminizi geliştirmek için çerezleri kullanıyoruz. Sitemizi kullanarak kabul etmiş sayılırsınız:",
            policy: "Çerez Politikası",
            button: "Kabul Et",
        },
    };

    const t = content[resolvedLang === "tr" ? "tr" : "en"];

    // Determine policy link based on language
    const policyLink = resolvedLang === "tr" ? "/tr/terms-of-use" : "/en/privacy-policy";

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 md:p-6 animate-slide-up-fade">
            <div className="max-w-4xl mx-auto bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-2xl rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-300 text-center sm:text-left leading-relaxed">
                    <span>{t.text} </span>
                    <Link
                        href={policyLink}
                        className="font-semibold text-primary hover:underline decoration-2 underline-offset-2 active-press inline-block"
                    >
                        {t.policy}
                    </Link>
                    .
                </div>
                <button
                    onClick={handleAccept}
                    className="w-full sm:w-auto px-8 py-3 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/25 transition-all transform hover:-translate-y-0.5 active:scale-95 active:translate-y-0 active:shadow-sm whitespace-nowrap"
                >
                    {t.button}
                </button>
            </div>
        </div>
    );
}
