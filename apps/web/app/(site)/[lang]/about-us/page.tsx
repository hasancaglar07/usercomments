import Link from "next/link";
import type { Metadata } from "next";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { buildMetadata } from "@/src/lib/seo";

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
                                About UserReview
                            </h1>
                            <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
                                We believe in the power of honest experiences. Our mission is to help people make better decisions through real reviews from real users.
                            </p>
                        </div>

                        <div className="bg-white dark:bg-[#1a2632] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 md:p-12 mb-12">
                            <div className="prose prose-slate dark:prose-invert max-w-none space-y-10">
                                <section>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Our Mission</h2>
                                    <p className="text-lg text-slate-600 dark:text-slate-300">
                                        UserReview was founded on a simple idea: that the best way to know if a product is worth your time and money is to hear from someone who has actually used it. In a world of biased advertisements and sponsored content, we provide a space for authentic, unbiased feedback.
                                    </p>
                                </section>

                                <section className="grid md:grid-cols-2 gap-8 my-12">
                                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
                                            <span className="material-symbols-outlined">verified</span>
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">Authentic Reviews</h3>
                                        <p className="text-slate-600 dark:text-slate-400">
                                            We use advanced moderation and verification systems to ensure that the reviews you read are genuine and helpful.
                                        </p>
                                    </div>
                                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
                                            <span className="material-symbols-outlined">group</span>
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">Built for Community</h3>
                                        <p className="text-slate-600 dark:text-slate-400">
                                            Our platform is built by the community, for the community. Every review helps someone else make a smarter choice.
                                        </p>
                                    </div>
                                </section>

                                <section>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">What We Offer</h2>
                                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                                        Whether you're looking for the best skincare product, a reliable tech gadget, or a trusted service, UserReview offers:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-3 text-slate-600 dark:text-slate-300 marker:text-primary">
                                        <li>Comprehensive reviews across hundreds of categories</li>
                                        <li>Real user photos and detailed pros/cons</li>
                                        <li>Community ratings and helpfulness votes</li>
                                        <li>Expert insights and trending product data</li>
                                    </ul>
                                </section>

                                <section className="bg-slate-900 text-white rounded-2xl p-8 md:p-10 text-center">
                                    <h2 className="text-2xl font-bold mb-4">Join Our Community</h2>
                                    <p className="text-slate-400 mb-8">
                                        Ready to share your own experiences? Join thousands of other reviewers and start helping today.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                        <Link
                                            href={localizePath("/node/add/review", lang)}
                                            className="px-8 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg transition-colors"
                                        >
                                            Write a Review
                                        </Link>
                                        <Link
                                            href={localizePath("/catalog", lang)}
                                            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition-colors border border-white/10"
                                        >
                                            Explore Catalog
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
        title: "About Us",
        description: "Learn more about UserReview and our mission to provide honest user feedback.",
        path: "/about-us",
        lang,
        type: "website",
    });
}
