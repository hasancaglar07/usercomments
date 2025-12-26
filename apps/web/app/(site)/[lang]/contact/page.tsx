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
    <div
      className="bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark font-display min-h-screen flex flex-col overflow-x-hidden"
      data-page="contact"
    >
      <main className="flex-1 w-full bg-background-light dark:bg-background-dark">
        <div className="layout-container flex h-full grow flex-col">
          <div className="px-5 md:px-20 lg:px-40 flex flex-1 justify-center py-8">
            <div className="layout-content-container flex flex-col max-w-[1280px] flex-1">
              {/* Breadcrumbs */}
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                <Link
                  className="text-text-secondary-light dark:text-text-secondary-dark text-sm font-medium leading-normal hover:text-primary dark:hover:text-primary transition-colors"
                  href={localizePath("/", lang)}
                >
                  {t(lang, "contact.breadcrumb.home")}
                </Link>
                <span className="text-text-secondary-light dark:text-text-secondary-dark text-sm font-medium leading-normal">
                  /
                </span>
                <span className="text-text-main-light dark:text-text-main-dark text-sm font-medium leading-normal">
                  {t(lang, "contact.breadcrumb.current")}
                </span>
              </div>

              {/* Page Heading */}
              <div className="flex flex-col gap-2 px-4 mb-8">
                <h1 className="text-text-main-light dark:text-text-main-dark tracking-tight text-[32px] md:text-[40px] font-bold leading-tight">
                  {t(lang, "contact.heading.title")}
                </h1>
                <p className="text-text-secondary-light dark:text-text-secondary-dark text-lg font-normal leading-normal max-w-2xl">
                  {t(lang, "contact.heading.subtitle")}
                </p>
              </div>

              <div className="flex flex-col lg:flex-row gap-8 px-4">
                {/* Contact Form Section */}
                <div className="flex-1 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 md:p-8 shadow-sm">
                  <form action="#" className="flex flex-col gap-6" method="POST">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <label className="flex flex-col flex-1 gap-2">
                        <p className="text-text-main-light dark:text-text-main-dark text-sm font-semibold leading-normal">
                          {t(lang, "contact.form.nameLabel")}
                        </p>
                        <input
                          className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary/20 focus:border-primary border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark h-12 placeholder:text-text-secondary-light dark:placeholder:text-text-secondary-dark px-4 text-base font-normal leading-normal transition-all"
                          placeholder={t(lang, "contact.form.namePlaceholder")}
                          required
                          type="text"
                        />
                      </label>
                      <label className="flex flex-col flex-1 gap-2">
                        <p className="text-text-main-light dark:text-text-main-dark text-sm font-semibold leading-normal">
                          {t(lang, "contact.form.emailLabel")}
                        </p>
                        <input
                          className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary/20 focus:border-primary border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark h-12 placeholder:text-text-secondary-light dark:placeholder:text-text-secondary-dark px-4 text-base font-normal leading-normal transition-all"
                          placeholder={t(lang, "contact.form.emailPlaceholder")}
                          required
                          type="email"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col flex-1 gap-2">
                      <p className="text-text-main-light dark:text-text-main-dark text-sm font-semibold leading-normal">
                        {t(lang, "contact.form.subjectLabel")}
                      </p>
                      <div className="relative">
                        <select className="form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary/20 focus:border-primary border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark h-12 px-4 pr-10 text-base font-normal leading-normal appearance-none transition-all">
                          <option disabled selected value="">
                            {t(lang, "contact.form.subjectPlaceholder")}
                          </option>
                          <option value="support">
                            {t(lang, "contact.form.subject.support")}
                          </option>
                          <option value="report">
                            {t(lang, "contact.form.subject.report")}
                          </option>
                          <option value="business">
                            {t(lang, "contact.form.subject.business")}
                          </option>
                          <option value="other">
                            {t(lang, "contact.form.subject.other")}
                          </option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary-light dark:text-text-secondary-dark">
                          <span className="material-symbols-outlined text-[20px]">
                            expand_more
                          </span>
                        </div>
                      </div>
                    </label>
                    <label className="flex flex-col flex-1 gap-2">
                      <p className="text-text-main-light dark:text-text-main-dark text-sm font-semibold leading-normal">
                        {t(lang, "contact.form.messageLabel")}
                      </p>
                      <textarea
                        className="form-textarea flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary/20 focus:border-primary border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark min-h-[160px] placeholder:text-text-secondary-light dark:placeholder:text-text-secondary-dark p-4 text-base font-normal leading-normal transition-all"
                        placeholder={t(lang, "contact.form.messagePlaceholder")}
                      ></textarea>
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark text-right">
                        {charCountLabel}
                      </p>
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark group-hover:text-primary text-[20px]">
                          attach_file
                        </span>
                        <span className="text-sm font-medium text-text-main-light dark:text-text-main-dark">
                          {t(lang, "contact.form.attach")}
                        </span>
                      </button>
                      <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                        {t(lang, "contact.form.attachHint")}
                      </span>
                    </div>
                    <div className="pt-2">
                      <button
                        className="flex w-full md:w-auto min-w-[160px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary hover:bg-primary-hover transition-all shadow-md hover:shadow-lg text-white text-base font-bold leading-normal tracking-[0.015em]"
                        type="submit"
                      >
                        {t(lang, "contact.form.submit")}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Sidebar Info */}
                <div className="w-full lg:w-[360px] flex flex-col gap-6">
                  {/* Quick Links Card */}
                  <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-4">
                      {t(lang, "contact.sidebar.title")}
                    </h3>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3 group">
                        <div className="mt-1 flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[18px]">
                            mail
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                            {t(lang, "contact.sidebar.support")}
                          </span>
                          <a
                            className="text-base font-semibold text-text-main-light dark:text-text-main-dark hover:text-primary transition-colors"
                            href="mailto:support@userreview.net"
                          >
                            support@userreview.net
                          </a>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 group">
                        <div className="mt-1 flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[18px]">
                            business_center
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                            {t(lang, "contact.sidebar.business")}
                          </span>
                          <a
                            className="text-base font-semibold text-text-main-light dark:text-text-main-dark hover:text-primary transition-colors"
                            href="mailto:support@userreview.net"
                          >
                            support@userreview.net
                          </a>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 group">
                        <div className="mt-1 flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[18px]">
                            shield
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                            {t(lang, "contact.sidebar.moderation")}
                          </span>
                          <a
                            className="text-base font-semibold text-text-main-light dark:text-text-main-dark hover:text-primary transition-colors"
                            href="mailto:support@userreview.net"
                          >
                            support@userreview.net
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FAQ Teaser Card */}
                  <div className="bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/10 dark:border-primary/20 p-6">
                    <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-3">
                      {t(lang, "contact.faq.title")}
                    </h3>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4 leading-relaxed">
                      {t(lang, "contact.faq.body")}
                    </p>
                    <Link
                      className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:text-primary-hover transition-colors"
                      href={localizePath("/contact", lang)}
                    >
                      {t(lang, "contact.faq.link")}
                      <span className="material-symbols-outlined text-[16px]">
                        arrow_forward
                      </span>
                    </Link>
                  </div>

                  {/* Map / Location (Optional visual element) */}
                  <div className="relative w-full h-48 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={t(lang, "contact.map.alt")}
                      className="w-full h-full object-cover opacity-80 hover:scale-105 transition-transform duration-700"
                      src="/stitch_assets/images/img-028.png"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                      <p className="text-white text-sm font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">
                          public
                        </span>
                        {t(lang, "contact.map.caption")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
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
