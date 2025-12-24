import Link from "next/link";
import type { Metadata } from "next";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { buildMetadata } from "@/src/lib/seo";

export const revalidate = 86400;

type PrivacyPolicyPageProps = {
    params: Promise<{ lang: string }>;
};

export default async function Page(props: PrivacyPolicyPageProps) {
    const params = await props.params;
    const lang = normalizeLanguage(params.lang);
    return (
        <div
            className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden"
            data-page="privacy-policy"
        >
            <div className="flex flex-col min-h-screen">
                {/* Main Layout */}
                <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Breadcrumbs */}
                    <nav aria-label="Breadcrumb" className="flex mb-8 text-sm">
                        <ol className="inline-flex items-center space-x-2">
                            <li className="inline-flex items-center">
                                <Link
                                    className="text-slate-500 hover:text-primary dark:text-slate-400"
                                    href={localizePath("/", lang)}
                                >
                                    Home
                                </Link>
                            </li>
                            <li className="text-slate-400">/</li>
                            <li className="inline-flex items-center">
                                <Link
                                    className="text-slate-500 hover:text-primary dark:text-slate-400"
                                    href={localizePath("/terms-of-use", lang)}
                                >
                                    Legal
                                </Link>
                            </li>
                            <li className="text-slate-400">/</li>
                            <li className="inline-flex items-center">
                                <span className="text-slate-900 font-medium dark:text-slate-100">
                                    Privacy Policy
                                </span>
                            </li>
                        </ol>
                    </nav>

                    <div className="flex flex-col lg:flex-row gap-10">
                        {/* Sidebar Navigation (Sticky) */}
                        <aside className="w-full lg:w-64 flex-shrink-0">
                            <div className="sticky top-24 lg:max-h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar">
                                <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 px-2">
                                        On this page
                                    </h3>
                                    <nav className="flex flex-col space-y-1">
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-md"
                                            href="#introduction"
                                        >
                                            Introduction
                                        </Link>
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors"
                                            href="#data-collection"
                                        >
                                            Data Collection
                                        </Link>
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors"
                                            href="#cookies"
                                        >
                                            Cookies &amp; Tracking
                                        </Link>
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors"
                                            href="#data-usage"
                                        >
                                            How We Use Data
                                        </Link>
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors"
                                            href="#third-party"
                                        >
                                            Third-Party Sharing
                                        </Link>
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors"
                                            href="#user-rights"
                                        >
                                            Your Rights
                                        </Link>
                                        <Link
                                            className="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors"
                                            href="#contact"
                                        >
                                            Contact Us
                                        </Link>
                                    </nav>
                                </div>
                                {/* CTA Box */}
                                <div className="mt-6 p-5 bg-gradient-to-br from-primary to-[#4BA3FF] rounded-xl text-white shadow-lg">
                                    <span className="material-symbols-outlined text-3xl mb-2">
                                        shield_person
                                    </span>
                                    <p className="text-sm font-medium mb-3 opacity-90">
                                        Have concerns about your data?
                                    </p>
                                    <Link
                                        className="inline-block w-full text-center py-2 px-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-bold transition-colors"
                                        href={localizePath("/contact", lang)}
                                    >
                                        Contact DPO
                                    </Link>
                                </div>
                            </div>
                        </aside>

                        {/* Content Area */}
                        <article className="flex-1 min-w-0">
                            <div className="bg-white dark:bg-[#1a2632] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 md:p-12">
                                {/* Page Header */}
                                <div className="border-b border-slate-100 dark:border-slate-700 pb-8 mb-10">
                                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                                        Privacy Policy
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[18px]">
                                                calendar_today
                                            </span>
                                            Last Updated: October 24, 2023
                                        </span>
                                        <span className="hidden sm:inline text-slate-300">|</span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[18px]">
                                                schedule
                                            </span>
                                            10 min read
                                        </span>
                                    </div>
                                </div>

                                {/* Text Content */}
                                <div className="prose prose-slate dark:prose-invert max-w-none space-y-12">
                                    <section className="scroll-mt-28" id="introduction">
                                        <p className="text-lg leading-8 text-slate-600 dark:text-slate-300">
                                            Welcome to iRecommend. We value your trust and are committed to protecting your personal information. This Privacy Policy outlines how we collect, use, disclose, and safeguard your data when you visit our website or use our services. By accessing or using iRecommend, you agree to the terms of this Privacy Policy.
                                        </p>
                                    </section>

                                    <section className="scroll-mt-28" id="data-collection">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                            <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                                                <span className="material-symbols-outlined">dataset</span>
                                            </span>
                                            1. Data Collection
                                        </h2>
                                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                                            We collect information that you provide directly to us, such as when you create an account, write a review, or contact our support team. This may include:
                                        </p>
                                        <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300 marker:text-primary">
                                            <li>
                                                <strong>Personal Identification:</strong> Name, email address, and profile picture.
                                            </li>
                                            <li>
                                                <strong>Content:</strong> Reviews, ratings, photos, and comments you post.
                                            </li>
                                            <li>
                                                <strong>Communications:</strong> Records of your correspondence with us.
                                            </li>
                                        </ul>
                                    </section>

                                    <section className="scroll-mt-28" id="cookies">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                            <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                                                <span className="material-symbols-outlined">cookie</span>
                                            </span>
                                            2. Cookies &amp; Tracking Technologies
                                        </h2>
                                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                                            We use cookies and similar tracking technologies to track the activity on our Service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
                                        </p>
                                        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary p-4 rounded-r-lg my-6">
                                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                                <strong>Note:</strong> We use both session cookies (which expire once you close your web browser) and persistent cookies (which stay on your device for a set period of time or until you delete them).
                                            </p>
                                        </div>
                                    </section>

                                    <section className="scroll-mt-28" id="data-usage">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                            <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                                                <span className="material-symbols-outlined">analytics</span>
                                            </span>
                                            3. How We Use Your Data
                                        </h2>
                                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                                            The information we collect is used to provide, maintain, and improve our services. Specifically, we use your data to:
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Service Delivery</h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">To create and manage your account and publish your reviews.</p>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Personalization</h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">To recommend products and services based on your interests.</p>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Communication</h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">To send you updates, security alerts, and administrative messages.</p>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Security</h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">To monitor and prevent unauthorized access or fraudulent activity.</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="scroll-mt-28" id="third-party">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                            <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                                                <span className="material-symbols-outlined">share</span>
                                            </span>
                                            4. Third-Party Sharing
                                        </h2>
                                        <p className="text-slate-600 dark:text-slate-300">
                                            We do not sell your personal data. However, we may share information with third-party vendors, service providers, contractors, or agents who perform services for us or on our behalf and require access to such information to do that work.
                                        </p>
                                    </section>

                                    <section className="scroll-mt-28" id="user-rights">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                            <span className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                                                <span className="material-symbols-outlined">gavel</span>
                                            </span>
                                            5. Your Rights
                                        </h2>
                                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                                            Depending on your location, you may have specific rights regarding your personal data:
                                        </p>
                                        <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300 marker:text-primary mb-6">
                                            <li>
                                                <strong>Right to Access:</strong> You can request copies of your personal data.
                                            </li>
                                            <li>
                                                <strong>Right to Rectification:</strong> You can request that we correct any information you believe is inaccurate.
                                            </li>
                                            <li>
                                                <strong>Right to Erasure:</strong> You can request that we erase your personal data, under certain conditions.
                                            </li>
                                        </ul>
                                        <p className="text-slate-600 dark:text-slate-300">
                                            To exercise these rights, please contact us at our provided support channels.
                                        </p>
                                    </section>

                                    <section className="scroll-mt-28 border-t border-slate-100 dark:border-slate-700 pt-8" id="contact">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Contact Us</h2>
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start">
                                            <div className="flex-1">
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">General Inquiries</h4>
                                                <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">For questions about this policy or our privacy practices.</p>
                                                <a
                                                    className="inline-flex items-center gap-2 text-primary hover:text-blue-600 font-semibold transition-colors"
                                                    href="mailto:privacy@irecommend.ru"
                                                >
                                                    <span className="material-symbols-outlined text-lg">mail</span>
                                                    privacy@irecommend.ru
                                                </a>
                                            </div>
                                            <div className="hidden md:block w-px h-24 bg-slate-200 dark:bg-slate-700"></div>
                                            <div className="flex-1">
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Mailing Address</h4>
                                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                                    iRecommend Legal Dept.<br />
                                                    123 Innovation Drive, Suite 400<br />
                                                    Tech City, TC 94000
                                                </p>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </article>
                    </div>
                </main>
            </div>
        </div>
    );
}

export async function generateMetadata(
    props: PrivacyPolicyPageProps
): Promise<Metadata> {
    const params = await props.params;
    const lang = normalizeLanguage(params.lang);
    return buildMetadata({
        title: "Privacy Policy",
        description: "Learn how we collect, use, and protect your information.",
        path: "/privacy-policy",
        lang,
        type: "website",
    });
}
