import AuthCtaButton from "@/components/auth/AuthCtaButton";

type EmptyStateProps = {
  title: string;
  description: string;
  ctaLabel: string;
  authenticatedHref?: string;
};

export default function EmptyState({
  title,
  description,
  ctaLabel,
  authenticatedHref = "/node/add/review",
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-8 text-center shadow-sm">
      <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-primary/10" />
        <div className="absolute inset-2 rounded-full bg-primary/20" />
        <span className="relative material-symbols-outlined text-primary text-2xl">
          rate_review
        </span>
      </div>
      <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">
        {title}
      </h3>
      <p className="mt-2 text-sm text-text-sub-light dark:text-text-sub-dark">
        {description}
      </p>
      <div className="mt-5 flex justify-center">
        <AuthCtaButton
          className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark transition-colors"
          authenticatedHref={authenticatedHref}
        >
          {ctaLabel}
        </AuthCtaButton>
      </div>
    </div>
  );
}
