"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PaidPlanCheckoutButton from "./PaidPlanCheckoutButton";

type FeatureId = "finance" | "resources" | "engagement" | "events";

const ROWS: { id: FeatureId; label: string; title: string; body: string }[] = [
  {
    id: "finance",
    label: "Finanzen & Buchhaltung",
    title: "Finanzen & Buchhaltung",
    body: "Kasse, Einträge und Exporte sind im Team- und Pro-Tarif enthalten — mit 14 Tagen Test vor der ersten Abbuchung.",
  },
  {
    id: "resources",
    label: "Ressourcen",
    title: "Ressourcen",
    body: "Materialien und Beschaffungen könnt ihr mit Team oder Pro nutzen — inklusive Testphase.",
  },
  {
    id: "engagement",
    label: "Engagement Score",
    title: "Engagement Score",
    body: "Punkte, Ranglisten und faire Verteilung sind in Team und Pro verfügbar — mit 14 Tagen Test.",
  },
  {
    id: "events",
    label: "Veranstaltungen",
    title: "Veranstaltungen",
    body: "Veranstaltungen als Rahmen für Schichten, Aufgaben und Ressourcen schaltet ihr mit Team oder Pro frei.",
  },
];

export default function StarterLockedFeatureRows() {
  const [openId, setOpenId] = useState<FeatureId | null>(null);
  const active = openId ? ROWS.find((r) => r.id === openId) : null;

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  return (
    <>
      {ROWS.map((row) => (
        <button
          key={row.id}
          type="button"
          className="p-feature p-feature-locked"
          style={{ opacity: 0.45 }}
          onClick={() => setOpenId(row.id)}
          aria-haspopup="dialog"
          aria-label={`${row.label}: nicht im Starter — Details und Upgrade`}
        >
          <svg className="p-check p-check-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <line x1="4" y1="8" x2="12" y2="8" />
          </svg>
          {row.label}
        </button>
      ))}

      {active ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="starter-locked-title"
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="starter-locked-title" className="text-lg font-semibold text-[var(--text-primary)]">
              {active.title}
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{active.body}</p>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Im kostenlosen Starter nicht enthalten — Upgrade auf Team oder Pro.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                onClick={() => setOpenId(null)}
              >
                Schließen
              </button>
              <Link
                href="#pricing-team"
                className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] no-underline"
                onClick={() => setOpenId(null)}
              >
                Team &amp; Pro vergleichen
              </Link>
              <PaidPlanCheckoutButton tier="base" className="btn btn-blue text-sm px-4 py-2" style={{ justifyContent: "center" }}>
                Team testen &amp; buchen
              </PaidPlanCheckoutButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
