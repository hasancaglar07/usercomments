import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";

let accessToken: string | null = null;
let currentUser: User | null = null;
let hasLoadedSession = false;
let authSubscriptionActive = false;
let initPromise: Promise<void> | null = null;
const listeners = new Set<(user: User | null) => void>();

function notify() {
  listeners.forEach((listener) => listener(currentUser));
}

function setSession(session: Session | null) {
  accessToken = session?.access_token ?? null;
  currentUser = session?.user ?? null;
  hasLoadedSession = true;
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
