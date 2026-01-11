export const runtime = 'edge';

import Link from "next/link";
import type { Metadata } from "next";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { buildMetadata } from "@/src/lib/seo";
import { t } from "@/src/lib/copy";

export const revalidate = 86400;

type ContactPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function Page(props: ContactPageProps) {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  const charCountLabel = t(lang, "contact.form.charCount", {
    current: 0,
    max: 2000,
  });

  return (
    <div className="min-h-screen bg-white dark:bg-background-dark font-sans text-text-main" data-page="contact">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-12">
          <ol className="flex items-center space-x-2 text-sm text-text-muted">
            <li>
              <Link href={localizePath("/", lang)} className="hover:text-primary transition-colors">
                {t(lang, "contact.breadcrumb.home")}
              </Link>
            </li>
            <li className="text-gray-300">/</li>
            <li className="font-medium text-text-main dark:text-white">
              {t(lang, "contact.breadcrumb.current")}
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-7">
            <header className="mb-12">
              <h1 className="text-4xl md:text-6xl font-black text-text-main dark:text-white tracking-tight mb-6">
                {t(lang, "contact.heading.title")}
              </h1>
              <p className="text-xl text-text-sub dark:text-gray-400 leading-relaxed max-w-2xl">
                {t(lang, "contact.heading.subtitle")}
              </p>
            </header>

            <form action="#" className="flex flex-col gap-6" method="POST">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex flex-col flex-1 gap-2">
                  <span className="text-sm font-bold text-text-main dark:text-white">
                    {t(lang, "contact.form.nameLabel")}
                  </span>
                  <input
                    className="w-full rounded-xl bg-gray-50 dark:bg-surface-dark border-transparent focus:border-primary focus:ring-4 focus:ring-primary/10 h-14 px-5 text-base transition-all dark:text-white"
                    placeholder={t(lang, "contact.form.namePlaceholder")}
                    required
                    type="text"
                  />
                </label>
                <label className="flex flex-col flex-1 gap-2">
                  <span className="text-sm font-bold text-text-main dark:text-white">
                    {t(lang, "contact.form.emailLabel")}
                  </span>
                  <input
                    className="w-full rounded-xl bg-gray-50 dark:bg-surface-dark border-transparent focus:border-primary focus:ring-4 focus:ring-primary/10 h-14 px-5 text-base transition-all dark:text-white"
                    placeholder={t(lang, "contact.form.emailPlaceholder")}
                    required
                    type="email"
                  />
                </label>
              </div>

              <label className="flex flex-col flex-1 gap-2">
                <span className="text-sm font-bold text-text-main dark:text-white">
                  {t(lang, "contact.form.subjectLabel")}
                </span>
                <div className="relative">
                  <select className="w-full appearance-none rounded-xl bg-gray-50 dark:bg-surface-dark border-transparent focus:border-primary focus:ring-4 focus:ring-primary/10 h-14 px-5 pr-10 text-base transition-all dark:text-white">
                    <option disabled selected value="">
                      {t(lang, "contact.form.subjectPlaceholder")}
                    </option>
                    <option value="support">{t(lang, "contact.form.subject.support")}</option>
                    <option value="report">{t(lang, "contact.form.subject.report")}</option>
                    <option value="business">{t(lang, "contact.form.subject.business")}</option>
                    <option value="other">{t(lang, "contact.form.subject.other")}</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-muted">
                    <span className="material-symbols-outlined">expand_more</span>
                  </div>
                </div>
              </label>

              <label className="flex flex-col flex-1 gap-2">
                <span className="text-sm font-bold text-text-main dark:text-white">
                  {t(lang, "contact.form.messageLabel")}
                </span>
                <textarea
                  className="w-full rounded-xl bg-gray-50 dark:bg-surface-dark border-transparent focus:border-primary focus:ring-4 focus:ring-primary/10 min-h-[200px] p-5 text-base transition-all dark:text-white resize-y"
                  placeholder={t(lang, "contact.form.messagePlaceholder")}
                ></textarea>
                <p className="text-xs text-text-muted text-right font-medium">
                  {charCountLabel}
                </p>
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-6 mt-4">
                <button
                  className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5"
                  type="submit"
                >
                  {t(lang, "contact.form.submit")}
                </button>

                <button
                  className="flex items-center gap-2 text-text-muted hover:text-primary transition-colors text-sm font-medium"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">attach_file</span>
                  {t(lang, "contact.form.attach")}
                </button>
              </div>
              <p className="text-xs text-text-muted">
                {t(lang, "contact.form.attachHint")}
              </p>
            </form>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-8 lg:pl-12">
            {/* Links */}
            <div className="bg-gray-50 dark:bg-surface-dark rounded-3xl p-8">
              <h3 className="text-xl font-bold text-text-main dark:text-white mb-6">
                {t(lang, "contact.sidebar.title")}
              </h3>
              <div className="space-y-6">
                {[
                  { icon: "mail", label: "contact.sidebar.support", href: "mailto:support@userreview.net" },
                  { icon: "business_center", label: "contact.sidebar.business", href: "mailto:support@userreview.net" },
                  { icon: "shield", label: "contact.sidebar.moderation", href: "mailto:support@userreview.net" }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-4 group">
                    <div className="mt-1 size-10 flex items-center justify-center rounded-full bg-white dark:bg-black text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                      <span className="material-symbols-outlined">{item.icon}</span>
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-text-muted mb-0.5">
                        {t(lang, item.label)}
                      </span>
                      <a
                        className="text-lg font-bold text-text-main dark:text-white hover:text-primary transition-colors"
                        href={item.href}
                      >
                        support@userreview.net
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Map Widget */}
            <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-gray-200 dark:bg-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={t(lang, "contact.map.alt")}
                className="w-full h-full object-cover opacity-80 hover:scale-105 transition-transform duration-700"
                src="/stitch_assets/images/img-028.png"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
                <p className="text-white font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">public</span>
                  {t(lang, "contact.map.caption")}
                </p>
              </div>
            </div>

            {/* FAQ Link */}
            <div className="p-6 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-center">
              <h3 className="text-lg font-bold text-text-main dark:text-white mb-2">
                {t(lang, "contact.faq.title")}
              </h3>
              <p className="text-sm text-text-muted mb-4">
                {t(lang, "contact.faq.body")}
              </p>
              <Link
                className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:text-primary-hover transition-colors"
                href={localizePath("/contact", lang)}
              >
                {t(lang, "contact.faq.link")}
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export async function generateMetadata(
  props: ContactPageProps
): Promise<Metadata> {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  return buildMetadata({
    title: t(lang, "contact.meta.title"),
    description: t(lang, "contact.meta.description"),
    path: "/contact",
    lang,
    type: "website",
  });
}
