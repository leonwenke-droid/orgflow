import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSubPage } from "../../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "API – OrgFlow",
  description: "Technische Übersicht der OrgFlow-API: Authentifizierung, Basis-URL, Ressourcen und Rate-Limits.",
  robots: { index: true, follow: true },
};

export default function ApiDocsPage() {
  return (
    <MarketingSubPage
      eyebrow="Ressourcen"
      title="API"
      lead="OrgFlow nutzt eine Web-API hinter authentifizierten Anfragen. Diese Übersicht richtet sich an Entwicklerinnen und Entwickler, die Integrationen oder Automatisierungen planen."
    >
      <h2>Authentifizierung</h2>
      <p>
        API-Zugriffe erfolgen im Namen einer angemeldeten Person: Sitzungen werden über
        sichere HTTP-only Cookies abgewickelt, die beim Login gesetzt werden. Für
        maschinelle Integrationen ohne Browser-Session (z.&nbsp;B. Cron-Jobs oder
        externe Dienste) bieten wir vertraglich vereinbarte Zugänge an — kontaktiert
        uns dafür unter{" "}
        <a href="mailto:info@lyniqmedia.com">info@lyniqmedia.com</a>.
      </p>

      <h2>Basis-URL</h2>
      <p>
        Alle Anfragen laufen gegen{" "}
        <code style={{ fontSize: "13px" }}>https://orgflow.de</code>. API-Endpunkte
        beginnen mit <code style={{ fontSize: "13px" }}>/api/</code> für serverseitige
        Aktionen. Alle Antworten sind JSON.
      </p>

      <h2>Ressourcen (Auszug)</h2>
      <ul>
        <li>
          <strong>Organisation &amp; Einstellungen</strong> — Metadaten, Module, Sichtbarkeit,
          Billing-Status.
        </li>
        <li>
          <strong>Mitglieder &amp; Einladungen</strong> — Profile, Rollen, Einladungslinks,
          Aktivierungsstatus.
        </li>
        <li>
          <strong>Aufgaben</strong> — Erstellen, zuweisen, Status-Änderung, Nachweise hochladen.
        </li>
        <li>
          <strong>Schichten</strong> — Planung, Zuweisungen, Check-in, Übergaben, Rotation.
        </li>
        <li>
          <strong>Veranstaltungen</strong> — Events erstellen und mit Schichten/Aufgaben verknüpfen.
        </li>
        <li>
          <strong>Finanzen / Kasse</strong> — Einträge lesen und exportieren je nach Berechtigung.
        </li>
        <li>
          <strong>Engagement</strong> — Score lesen, Punkte-Events einsehen, Rangliste abrufen.
        </li>
      </ul>

      <h2>Rate-Limits &amp; Fair Use</h2>
      <p>
        Zum Schutz aller Nutzerinnen und Nutzer gelten angemessene Limits für
        automatisierte Anfragen. Ungewöhnliches Verhalten wird gedrosselt und
        geloggt. Bei geplantem hohem Volumen kontaktiert uns bitte vorab — wir
        finden eine Lösung.
      </p>

      <h2>Stabilität &amp; Versionierung</h2>
      <p>
        Endpunkte können zwischen Releases erweitert werden. Breaking Changes werden
        im <Link href="/changelog">Changelog</Link> angekündigt. Für stabile
        Integrationen empfehlen wir, Änderungen mit uns abzustimmen.
      </p>

      <p className="subpage-meta" style={{ marginTop: "2rem" }}>
        <Link href="/docs">← Zur Dokumentations-Übersicht</Link>
      </p>
    </MarketingSubPage>
  );
}
