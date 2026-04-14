/**
 * Illustrative examples (no claim to real customer count) + infinite marquee.
 */

import type { ReactNode } from "react";

/** Nur Marken-Palette (Guide): Blau, Grün, Amber, Rot, Ink/Neutral — kein Dekor-Violett/Teal & Co. */
const BRAND_MARK_ROTATION = [
  "logos-mark--blue",
  "logos-mark--green",
  "logos-mark--amber",
  "logos-mark--red",
  "logos-mark--slate",
] as const;

type Org = {
  name: string;
  tag: string;
  markIndex: number;
  Mark: () => ReactNode;
};

function MarkWaves() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className="logos-svg">
      <path
        d="M4 20c3-4 7-4 10 0s7 4 10 0 5-4 8-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M4 24c3-3 7-3 10 0s7 3 10 0 5-3 8-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

function MarkBall() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className="logos-svg">
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M10 12c2.5 2 9 2 12 0M11 20c3-1.5 9-1.5 12 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function MarkFlame() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className="logos-svg">
      <path
        d="M16 6c-1 4-5 5-5 10 0 4 2.5 7 5 8 2.5-1 5-4 5-8 0-5-4-6-5-10Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 18c0 2 1 3.5 2 4.5 1-1 2-2.5 2-4.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function MarkCross() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className="logos-svg">
      <path d="M16 8v16M10 14h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.25" opacity="0.35" />
    </svg>
  );
}

function MarkNote() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className="logos-svg">
      <path d="M11 24V10h6v10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 14h4v10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function MarkSail() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className="logos-svg">
      <path d="M10 24h14M14 24V9l9 11H14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MarkTarget() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className="logos-svg">
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
    </svg>
  );
}

function MarkBook() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className="logos-svg">
      <path
        d="M11 8h6a3 3 0 0 1 3 3v13H11a2 2 0 0 0-2 2v-15a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M20 8h1a2 2 0 0 1 2 2v14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

function MarkAnchor() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className="logos-svg">
      <path d="M16 7v18M11 19h10M8 22c1.5 3 4 5 8 5s6.5-2 8-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="16" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MarkHandball() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className="logos-svg">
      <rect x="9" y="9" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 16h8M16 12v8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function MarkPaw() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className="logos-svg">
      <ellipse cx="11" cy="12" rx="2.2" ry="3" fill="currentColor" opacity="0.5" />
      <ellipse cx="16" cy="10" rx="2.2" ry="3" fill="currentColor" opacity="0.5" />
      <ellipse cx="21" cy="12" rx="2.2" ry="3" fill="currentColor" opacity="0.5" />
      <path
        d="M11 20c1.5 4 8.5 4 10 0 1-2.5-1-5-5-5s-6 2.5-5 5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ORGS: Org[] = [
  { name: "TGG Leer", tag: "Showtanz & Auftritte", markIndex: 0, Mark: MarkWaves },
  { name: "SV Frisia Weener", tag: "Fußball · Emsland", markIndex: 1, Mark: MarkBall },
  { name: "Feuerwehr LZ Stadtmitte", tag: "Leer 26789", markIndex: 2, Mark: MarkFlame },
  { name: "DRK Ortsverein Leer", tag: "Bereitschaft & Hilfe", markIndex: 3, Mark: MarkCross },
  { name: "Musikzug Loga", tag: "Tradition & Umzüge", markIndex: 4, Mark: MarkNote },
  { name: "Regatta-Club Ems-Jade", tag: "Training am Wasser", markIndex: 5, Mark: MarkSail },
  { name: "Schützenverein Bingum", tag: "Festwirtschaft & mehr", markIndex: 6, Mark: MarkTarget },
  { name: "Förderverein Gymnasium", tag: "Leer · Schulprojekte", markIndex: 7, Mark: MarkBook },
  { name: "Hafen-Crew Leer", tag: "Markt & Kultur", markIndex: 8, Mark: MarkAnchor },
  { name: "HSG Leer/Tinnen", tag: "Handball Jugend", markIndex: 9, Mark: MarkHandball },
  { name: "Tierheim Leer e.V.", tag: "Ehrenamt & Spenden", markIndex: 10, Mark: MarkPaw },
];

function LogoStrip({ dup }: { dup?: boolean }) {
  return (
    <div className={`logos-set${dup ? " logos-set--dup" : ""}`} aria-hidden={dup}>
      {ORGS.map((org) => (
        <div key={`${org.name}-${dup ? "b" : "a"}`} className="logos-item">
          <div
            className={`logos-mark ${BRAND_MARK_ROTATION[org.markIndex % BRAND_MARK_ROTATION.length]}`}
            aria-hidden
          >
            <org.Mark />
          </div>
          <div className="logos-text">
            <span className="logos-name">{org.name}</span>
            <span className="logos-tag">{org.tag}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Logos() {
  return (
    <section className="logos" aria-label="Organisationen aus der Region">
      <div className="container logos-intro">
               <p className="logos-label">
          <strong>Beispielorganisationen</strong> (illustrativ) — so könnten Vereine, Schulen und Teams aus{" "}
          <strong>Leer, Ostfriesland &amp; dem Norden</strong> heißen:
        </p>
      </div>
      <div className="logos-marquee" role="presentation">
        <div className="logos-track">
          <LogoStrip />
          <LogoStrip dup />
        </div>
      </div>
    </section>
  );
}
