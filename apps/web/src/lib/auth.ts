import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";
import { AUTH_COOKIE_NAME } from "./auth-cookies";

let accessToken: string | null = null;
let currentUser: User | null = null;
let hasLoadedSession = false;
let authSubscriptionActive = false;
let initPromise: Promise<void> | null = null;
const listeners = new Set<(user: User | null) => void>();
const AUTH_COOKIE_VALUE = "1";

function notify() {
  listeners.forEach((listener) => listener(currentUser));
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") {
    return;
  }
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function syncAuthCookie(session: Session | null) {
  if (!session?.access_token) {
    clearCookie(AUTH_COOKIE_NAME);
    return;
  }
  const maxAge =
    typeof session.expires_in === "number" && session.expires_in > 0
      ? session.expires_in
      : 60 * 60;
  setCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE, maxAge);
}

function setSession(session: Session | null) {
  accessToken = session?.access_token ?? null;
  currentUser = session?.user ?? null;
  hasLoadedSession = true;
  syncAuthCookie(session);
  notify();
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function subscribeAuth(listener: (user: User | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function initAuth() {
  if (initPromise) {
    return initPromise;
  }
  initPromise = (async () => {
    const supabase = getSupabaseClient();
    if (!hasLoadedSession) {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
    }
    if (!authSubscriptionActive) {
      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });
      authSubscriptionActive = true;
    }
  })();
  await initPromise;
}

export async function ensureAuthLoaded() {
  if (hasLoadedSession) {
    return;
  }
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  setSession(data.session ?? null);
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  setSession(data.session ?? null);

  return data;
}

export async function signUpWithPassword(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  setSession(data.session ?? null);

  return data;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
  setSession(null);
}
