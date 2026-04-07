"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../components/LocaleProvider";
import { t } from "../../lib/i18n";

type Search = {
  org?: string;
  assignmentId?: string;
  shiftId?: string;
  qr_token?: string;
  auto?: string;
};

function mapApiMessage(raw: string, locale: "en" | "de"): string {
  const m = String(raw || "").trim();
  const map: Record<string, string> = {
    "Sign in required.": t("checkin.error_sign_in", locale),
    Forbidden: t("checkin.error_failed", locale),
    "Assignment not found.": t("checkin.error_failed", locale),
    "Shift not found.": t("checkin.error_failed", locale),
    "Profile not found.": t("checkin.error_failed", locale),
    "No assignment for you on this shift.": t("checkin.error_failed", locale),
    invalid_or_expired_token: t("shifts.checkin.invalid_token", locale),
    not_registered: t("shifts.checkin.not_registered", locale),
    already_checked_in: t("shifts.checkin.already_checked_in", locale)
  };
  if (map[m]) return map[m];
  if (
    m.startsWith("Several assignments found") ||
    m.includes("Mehrere Zuweisungen")
  ) {
    return m;
  }
  return m || t("checkin.error_failed", locale);
}

export default function CheckinPage({ searchParams }: { searchParams?: Search }) {
  const { locale } = useLocale();
  const orgSlug = String(searchParams?.org ?? "").trim();
  const assignmentId = String(searchParams?.assignmentId ?? "").trim();
  const shiftId = String(searchParams?.shiftId ?? "").trim();
  const qrToken = String(searchParams?.qr_token ?? "").trim();
  const autoPost = String(searchParams?.auto ?? "").trim() === "1";

  const hasTarget = !!(orgSlug && (assignmentId || shiftId || qrToken));
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">(
    !hasTarget ? "error" : "idle"
  );
  const [message, setMessage] = useState<string>(
    !hasTarget ? t("checkin.error_invalid", locale) : ""
  );

  const runCheckin = useCallback(async () => {
    if (!orgSlug || (!assignmentId && !shiftId && !qrToken)) {
      setState("error");
      setMessage(t("checkin.error_invalid", locale));
      return;
    }
    setState("loading");
    setMessage(t("checkin.loading", locale));
    try {
      const body: Record<string, string> = { orgSlug };
      if (assignmentId) body.assignmentId = assignmentId;
      if (shiftId) body.shiftId = shiftId;
      if (qrToken) body.qr_token = qrToken;

      const res = await fetch("/api/shifts/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(mapApiMessage(data.message ?? "", locale));
        return;
      }
      setState("ok");
      setMessage(
        data.alreadyCheckedIn
          ? t("checkin.success_already", locale)
          : t("checkin.success", locale)
      );
    } catch {
      setState("error");
      setMessage(t("checkin.error_network", locale));
    }
  }, [orgSlug, assignmentId, shiftId, qrToken, locale]);

  useEffect(() => {
    if (!hasTarget) {
      setState("error");
      setMessage(t("checkin.error_invalid", locale));
      return;
    }
    if (autoPost) {
      void runCheckin();
    }
  }, [hasTarget, autoPost, runCheckin, locale]);

  const intro = qrToken
    ? t("checkin.intro_qr_token", locale)
    : shiftId && !assignmentId
      ? t("checkin.intro_shift", locale)
      : t("checkin.intro_assignment", locale);

  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-bold text-text-primary dark:text-text-primary">
        {t("checkin.title", locale)}
      </h1>
      {hasTarget && !autoPost && state === "idle" && (
        <p className="mt-3 text-sm text-text-secondary dark:text-text-muted">{intro}</p>
      )}
      <p className="mt-3 text-sm text-text-secondary dark:text-text-muted">
        {state === "idle" && !autoPost ? "" : message}
      </p>
      {hasTarget && !autoPost && state === "idle" && (
        <button
          type="button"
          onClick={() => void runCheckin()}
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {t("checkin.cta", locale)}
        </button>
      )}
      <p className="mt-6 text-left text-[11px] text-text-secondary dark:text-text-muted">
        {t("checkin.docs_hint", locale)}
      </p>
      {orgSlug && (
        <a
          className="mt-4 inline-block text-sm text-blue-600 underline dark:text-blue-400"
          href={`/${encodeURIComponent(orgSlug)}/dashboard`}
        >
          {t("checkin.back_dashboard", locale)}
        </a>
      )}
    </div>
  );
}
