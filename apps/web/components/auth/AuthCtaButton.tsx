"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";

type AuthCtaButtonProps = {
  className: string;
  children: React.ReactNode;
  authenticatedHref?: string;
  guestHref?: string;
  as?: "button" | "a";
};

export default function AuthCtaButton({
  className,
  children,
  authenticatedHref = "/node/add/review",
  guestHref = "/user/login",
  as = "button",
}: AuthCtaButtonProps) {
  const router = useRouter();
  const params = useParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );
  const { isAuthenticated, loading } = useAuth();

  const resolvedAuthHref = localizePath(authenticatedHref, lang);
  const resolvedGuestHref = guestHref.startsWith("/")
    ? (() => {
      const base =
        typeof window !== "undefined" ? window.location.origin : "http://localhost";
      const url = new URL(localizePath(guestHref, lang), base);
      if (!url.searchParams.has("next")) {
        url.searchParams.set("next", resolvedAuthHref);
      }
      return `${url.pathname}${url.search}`;
    })()
    : guestHref;
  const linkHref = isAuthenticated ? resolvedAuthHref : resolvedGuestHref;
  const isInternal = linkHref.startsWith("/");

  const handlePrefetch = () => {
    if (loading || !isInternal) {
      return;
    }
    router.prefetch(linkHref);
  };

  const handleAnchorClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
  };

  if (as === "a") {
    if (isInternal) {
      return (
        <Link
          className={`${className} active-press`}
          href={linkHref}
          onClick={handleAnchorClick}
          onMouseEnter={handlePrefetch}
          onFocus={handlePrefetch}
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        className={`${className} active-press`}
        href={linkHref}
        onClick={handleAnchorClick}
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
      >
        {children}
      </a>
    );
  }

  const handleButtonClick = () => {
    if (loading) {
      return;
    }
    if (isInternal) {
      router.push(linkHref);
      return;
    }
    if (typeof window !== "undefined") {
      window.location.href = linkHref;
    }
  };

  return (
    <button
      className={`${className} active-press shine-effect`}
      onClick={handleButtonClick}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      type="button"
    >
      {children}
    </button>
  );
}
