"use client";

import { useState } from "react";
import AuthForm from "../AuthForm";
import { useLocale } from "../LocaleProvider";
import AuthRegisterForm from "./AuthRegisterForm";

export default function AuthLoginRegisterCard({
  redirectTo,
  orgName
}: {
  redirectTo: string;
  orgName?: string | null;
}) {
  const { locale } = useLocale();
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="auth-card space-y-5">
      <div>
        <h1 className="auth-title">
          {mode === "register"
            ? (locale === "de" ? "Konto erstellen" : "Create account")
            : (locale === "de" ? "Anmelden" : "Sign in")}
        </h1>
        <p className="auth-sub">
          {orgName ? <span className="font-medium text-text-secondary">{orgName}</span> : null}
          <span className={`${orgName ? "mt-1 block" : ""} font-normal`}>
            {mode === "register"
              ? (locale === "de"
                  ? "Du bekommst eine E-Mail zur Bestätigung. Danach kannst du dich anmelden."
                  : "You’ll receive an email verification link. After that, you can sign in.")
              : (locale === "de"
                  ? "Melde dich mit deinem Organisationskonto an."
                  : "Sign in to your organisation account.")}
          </span>
        </p>
      </div>

      {mode === "register" ? (
        <AuthRegisterForm next={redirectTo} />
      ) : (
        <AuthForm redirectTo={redirectTo} />
      )}

      <div className="border-t border-border-subtle pt-4">
        <button
          type="button"
          onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
          className="w-full text-center text-xs font-medium text-[var(--blue-600)] hover:text-[var(--blue-800)] dark:text-[var(--blue-400)] dark:hover:text-[var(--blue-200)]"
        >
          {mode === "register"
            ? (locale === "de" ? "Schon ein Konto? Anmelden" : "Already have an account? Sign in")
            : (locale === "de" ? "Noch kein Konto? Konto erstellen" : "No account yet? Create one")}
        </button>
      </div>
    </div>
  );
}

