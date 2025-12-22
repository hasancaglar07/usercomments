"use client";

import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser, initAuth, subscribeAuth } from "@/src/lib/auth";

function getProfileSlug(user: User): string | null {
  const metadata = user.user_metadata as Record<string, unknown> | null;
  const username =
    metadata && typeof metadata.username === "string"
      ? metadata.username
      : null;
  if (username) {
    return username;
  }
  if (user.email) {
    return user.email.split("@")[0] ?? null;
  }
  return null;
}

function updateHeaderAuth(user: User | null) {
  const authLink = document.querySelector<HTMLAnchorElement>("[data-auth-link]");
  const authLabel =
    document.querySelector<HTMLSpanElement>("[data-auth-label]");
  if (!authLink || !authLabel) {
    return;
  }
  if (user) {
    const slug = getProfileSlug(user);
    authLabel.textContent = slug ?? "Account";
    authLink.setAttribute(
      "href",
      slug ? `/users/${encodeURIComponent(slug)}` : "/user/login"
    );
  } else {
    authLabel.textContent = "Sign In";
    authLink.setAttribute("href", "/user/login");
  }
}

export default function AuthSync() {
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const init = async () => {
      await initAuth();
      updateHeaderAuth(getCurrentUser());
      unsubscribe = subscribeAuth((user) => {
        updateHeaderAuth(user);
      });
    };
    init();
    return () => {
      unsubscribe?.();
    };
  }, []);

  return null;
}
