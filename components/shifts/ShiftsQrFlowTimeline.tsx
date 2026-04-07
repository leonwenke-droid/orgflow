"use client";

import Link from "next/link";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";

export default function ShiftsQrFlowTimeline() {
  const { locale } = useLocale();

  const steps = [
    { n: 1, tone: "accent" as const, titleKey: "shifts.qrflow_step1_title", bodyKey: "shifts.qrflow_step1_body", code: true },
    { n: 2, tone: "accent" as const, titleKey: "shifts.qrflow_step2_title", bodyKey: "shifts.qrflow_step2_body", code: false },
    { n: 3, tone: "success" as const, titleKey: "shifts.qrflow_step3_title", bodyKey: "shifts.qrflow_step3_body", variants: true },
    { n: 4, tone: "success" as const, titleKey: "shifts.qrflow_step4_title", bodyKey: "shifts.qrflow_step4_body", banner: true },
    { n: 5, tone: "muted" as const, titleKey: "shifts.qrflow_step5_title", bodyKey: "shifts.qrflow_step5_body", code: false }
  ];

  const dotBg = (tone: "accent" | "success" | "muted") => {
    if (tone === "accent") return "linear-gradient(145deg, #7eb0ff, #4a7fd4)";
    if (tone === "success") return "linear-gradient(145deg, #4ade80, #22c55e)";
    return "linear-gradient(145deg, #9ca3af, #6b7280)";
  };

  return (
    <div className="space-y-0 pt-1">
      {steps.map((s, i) => (
        <div key={s.n} className="flex gap-4 pb-5">
          <div className="flex w-10 shrink-0 flex-col items-center">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold shadow-md"
              style={{
                background: dotBg(s.tone),
                color: "#07080c",
                border: "2px solid rgba(255,255,255,0.12)"
              }}
            >
              {s.n}
            </div>
            {i < steps.length - 1 ? (
              <div
                className="mt-1 w-0.5 flex-1 min-h-[12px] rounded-full"
                style={{
                  background: "linear-gradient(180deg, var(--sc-border-strong, rgba(255,255,255,0.14)), transparent)"
                }}
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <h3 className="mb-1.5 text-[15px] font-semibold tracking-tight text-[var(--sc-text,#f4f5f7)]">
              {t(s.titleKey as "shifts.qrflow_step1_title", locale)}
            </h3>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--sc-text2, #9ca3b0)" }}>
              {t(s.bodyKey as "shifts.qrflow_step1_body", locale)}
            </p>
            {s.code ? (
              <pre className="sc-code mt-3">
                shift_id: abc123 · qr_token: xK9mP2nQ · valid: 2026-03-23T08:00–13:00
              </pre>
            ) : null}
            {s.variants ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div
                  className="rounded-[var(--sc-radius-md,14px)] border border-[var(--sc-border)] bg-[var(--sc-surface2)] p-3.5"
                  style={{ borderTopWidth: 3, borderTopColor: "var(--sc-accent, #6d9eff)" }}
                >
                  <div className="mb-1.5 text-xs font-bold" style={{ color: "var(--sc-accent)" }}>
                    {t("shifts.qrflow_variant_a_title", locale)}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--sc-text2)" }}>
                    {t("shifts.qrflow_variant_a_body", locale)}
                  </p>
                </div>
                <div
                  className="rounded-[var(--sc-radius-md,14px)] border border-[var(--sc-border)] bg-[var(--sc-surface2)] p-3.5"
                  style={{ borderTopWidth: 3, borderTopColor: "var(--sc-success, #3dd68c)" }}
                >
                  <div className="mb-1.5 text-xs font-bold" style={{ color: "var(--sc-success)" }}>
                    {t("shifts.qrflow_variant_b_title", locale)}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--sc-text2)" }}>
                    {t("shifts.qrflow_variant_b_body", locale)}
                  </p>
                </div>
              </div>
            ) : null}
            {s.banner ? (
              <div
                className="mt-3 rounded-[var(--sc-radius-sm,10px)] border px-3 py-2.5 text-xs font-medium"
                style={{
                  background: "var(--sc-success-dim)",
                  borderColor: "rgba(61,214,140,0.3)",
                  color: "var(--sc-success)"
                }}
              >
                +2 {locale === "de" ? "Punkte für" : "points for"} Leon Wenke · Aufbau Bühne · 23.03.2026 · 08:53
              </div>
            ) : null}
          </div>
        </div>
      ))}
      <p className="pt-2 text-xs" style={{ color: "var(--sc-text3)" }}>
        <Link href="/docs/shift-checkin" className="underline hover:opacity-90">
          {t("shifts.qrflow_docs_link", locale)}
        </Link>
      </p>
    </div>
  );
}
