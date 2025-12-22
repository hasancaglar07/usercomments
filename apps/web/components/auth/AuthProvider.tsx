"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser, initAuth, subscribeAuth } from "@/src/lib/auth";

type AuthState = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        await initAuth();
      } catch (error) {
        console.error("Failed to initialize auth", error);
        if (isMounted) {
          setLoading(false);
        }
        return;
      }
      if (!isMounted) {
        return;
      }
      setUser(getCurrentUser());
      setLoading(false);
      unsubscribe = subscribeAuth((nextUser) => {
        setUser(nextUser);
        setLoading(false);
      });
    };

    init();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
