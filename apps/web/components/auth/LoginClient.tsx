"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPassword, signUpWithPassword } from "@/src/lib/auth";

export default function LoginClient() {
  const router = useRouter();

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("[data-auth-form]");
    const emailInput = document.querySelector<HTMLInputElement>(
      "[data-auth-email]"
    );
    const passwordInput = document.querySelector<HTMLInputElement>(
      "[data-auth-password]"
    );
    const signUpLink = document.querySelector<HTMLAnchorElement>(
      "[data-auth-signup]"
    );

    if (!form || !emailInput || !passwordInput) {
      return;
    }

    const handleSubmit = async (event: Event) => {
      event.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        window.alert("Please enter your email and password.");
        return;
      }

      try {
        await signInWithPassword(email, password);
        router.push("/");
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "Login failed.";
        window.alert(message);
      }
    };

    const handleSignUp = async (event: Event) => {
      event.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        window.alert("Please enter your email and password.");
        return;
      }

      try {
        const result = await signUpWithPassword(email, password);
        if (!result.session) {
          window.alert("Check your email to confirm your account.");
          return;
        }
        router.push("/");
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "Sign up failed.";
        window.alert(message);
      }
    };

    form.addEventListener("submit", handleSubmit);
    signUpLink?.addEventListener("click", handleSignUp);

    return () => {
      form.removeEventListener("submit", handleSubmit);
      signUpLink?.removeEventListener("click", handleSignUp);
    };
  }, [router]);

  return null;
}
