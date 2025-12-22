"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

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
  const { isAuthenticated, loading } = useAuth();

  const resolvedGuestHref = guestHref.startsWith("/")
    ? (() => {
        const base =
          typeof window !== "undefined" ? window.location.origin : "http://localhost";
        const url = new URL(guestHref, base);
        if (!url.searchParams.has("next")) {
          url.searchParams.set("next", authenticatedHref);
        }
        return `${url.pathname}${url.search}`;
      })()
    : guestHref;
  const linkHref = isAuthenticated ? authenticatedHref : resolvedGuestHref;
  const isInternal = linkHref.startsWith("/");

  const handleAnchorClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
  };

  if (as === "a") {
    if (isInternal) {
      return (
        <Link className={className} href={linkHref} onClick={handleAnchorClick}>
          {children}
        </Link>
      );
    }
    return (
      <a className={className} href={linkHref} onClick={handleAnchorClick}>
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
    <button className={className} onClick={handleButtonClick} type="button">
      {children}
    </button>
  );
}
