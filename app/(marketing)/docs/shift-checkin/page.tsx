import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSubPage } from "../../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "Schichten & Anwesenheit (QR) – OrgFlow",
  description:
    "Ablauf von Schichtzuweisung bis Check-in: QR-Code, Admin-Bestätigung und Anwesenheitsmodi in OrgFlow.",
  robots: { index: true, follow: true },
};

export default function ShiftCheckinDocsPage() {
  return (
    <MarketingSubPage
      eyebrow="Ressourcen"
      title="Schichten &amp; Anwesenheit"
      lead="So hängen Zuweisung, persönlicher Check-in-Link und QR-Scan zusammen — und wann Admins statt QR bestätigen."
    >
      <h2>Überblick</h2>
      <p>
        Pro Schicht legt ihr fest, <strong>wie</strong> Anwesenheit erfasst wird:{" "}
        <strong>QR</strong> (Mitglied scannt oder zeigt Code), <strong>nur Admin</strong> (manuelle Liste im
        Admin-Bereich) oder <strong>keine</strong> Erfassung. Die Zuweisungsart (Selbsteintragung, automatisch,
        Rotation, fest) steuert, wie Plätze besetzt werden — unabhängig vom Anwesenheitsmodus.
      </p>

      <h2>Ablauf als Zeitstrahl</h2>
      <ol style={{ lineHeight: 1.7 }}>
        <li>
          <strong>Schicht anlegen</strong> — Admin legt Termin, Kapazität, Zuweisungsart und Anwesenheitsmodus fest.
        </li>
        <li>
          <strong>Plätze besetzen</strong> — Mitglieder tragen sich ein, werden automatisch zugewiesen, per Rotation
          oder fest vom Admin besetzt.
        </li>
        <li>
          <strong>Vor dem Einsatz</strong> — Bei Modus <em>QR</em> erhalten zugewiesene Personen einen persönlichen
          Check-in-Link (und können den QR-Code in der Mitgliedsansicht anzeigen). Admins können denselben Link als
          PNG exportieren.
        </li>
        <li>
          <strong>Check-in vor Ort</strong> — Variante A: Mitglied öffnet den Link (oder zeigt den QR-Code), die App
          bestätigt die Anwesenheit. Variante B: Admin scannt den angezeigten Mitglied-QR mit der Kamera im
          Admin-Bereich; die Anfrage läuft über dieselbe Check-in-Schnittstelle.
        </li>
        <li>
          <strong>Admin ohne QR</strong> — Bei Modus <em>nur Admin</em> ist der Selbst-Check-in für Mitglieder
          gesperrt; ihr markiert Anwesenheit in der Schichtliste (entspricht einer manuellen Bestätigung inkl.
          Protokollierung).
        </li>
        <li>
          <strong>Auswertung</strong> — Erfasste Check-ins und Status lassen sich in Berichten und Exporten
          auswerten; Schichten ohne Erfassung liefern dazu keine Check-in-Zeitstempel.
        </li>
      </ol>

      <h2>Kurzentscheidung: Welcher Modus?</h2>
      <ul>
        <li>
          <strong>QR</strong> — Schnell vor Ort, wenig Admin-Aufwand; braucht Smartphone oder ausgedruckten Code.
        </li>
        <li>
          <strong>Nur Admin</strong> — Wenn ihr ohne Geräte arbeitet oder bewusst alles per Liste abhakt.
        </li>
        <li>
          <strong>Keine</strong> — Reine Planung ohne Anwesenheitsnachweis.
        </li>
      </ul>

      <p>
        <Link href="/docs">Zurück zur Dokumentationsübersicht</Link>
      </p>
    </MarketingSubPage>
  );
}
