import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSubPage } from "../../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "API – OrgFlow",
  description: "Technische Übersicht der OrgFlow-API: Authentifizierung, Basis-URL und Ressourcen.",
  robots: { index: true, follow: true },
};

export default function ApiDocsPage() {
  return (
    <MarketingSubPage
      eyebrow="Ressourcen"
      title="API"
      lead="OrgFlow nutzt eine moderne Web-API hinter authentifizierten Anfragen. Die folgende Übersicht richtet sich an Entwicklerinnen und Entwickler, die Integrationen oder Automatisierungen planen."
    >
      <h2>Authentifizierung</h2>
      <p>
        API-Zugriffe erfolgen im Namen einer angemeldeten Person: Sitzungen werden über sichere Cookies bzw. das
        Auth-System eurer Organisation abgewickelt. Für maschinelle Integrationen ohne Browser-Session bieten wir
        ausgewählte, vertraglich vereinbarte Zugänge an — sprecht uns dafür unter{" "}
        <a href="mailto:hello@orgflow.de">hello@orgflow.de</a> an.
      </p>

      <h2>Basis-URL</h2>
      <p>
        Alle Anfragen laufen gegen die Domain eurer OrgFlow-Installation (z.&nbsp;B.{" "}
        <code style={{ fontSize: "13px", color: "var(--text-primary)" }}>https://www.orgflow.de</code>
        ). Konkrete Pfade beginnen typischerweise mit <code style={{ fontSize: "13px" }}>/api/</code> für
        serverseitige Aktionen.
      </p>

      <h2>Ressourcen (Auszug)</h2>
      <ul>
        <li>
          <strong>Organisation &amp; Einstellungen</strong> — Metadaten, Module, Sichtbarkeit.
        </li>
        <li>
          <strong>Mitglieder &amp; Einladungen</strong> — Profile, Rollen, Einladungslinks.
        </li>
        <li>
          <strong>Aufgaben</strong> — Erstellen, zuweisen, Status, Nachweise.
        </li>
        <li>
          <strong>Schichten</strong> — Planung, Zuweisungen, Check-in.
        </li>
        <li>
          <strong>Finanzen / Kasse</strong> — Einträge und Exporte je nach Berechtigung.
        </li>
      </ul>
      <p>
        Endpunkte können zwischen Releases erweitert werden. Für stabile Integrationen empfehlen wir, Änderungen mit
        uns abzustimmen oder über unseren{" "}
        <Link href="/changelog">Changelog</Link> zu verfolgen.
      </p>

      <h2>Rate-Limits &amp; Fair Use</h2>
      <p>
        Zum Schutz aller Nutzerinnen und Nutzer gelten angemessene Limits für automatisierte Anfragen. Ungewöhnliches
        Verhalten kann vorübergehend gedrosselt werden. Bei geplantem hohem Volumen kontaktiert uns bitte vorab.
      </p>

      <p className="subpage-meta" style={{ marginTop: "2rem" }}>
        <Link href="/docs">← Zur Dokumentations-Übersicht</Link>
      </p>
    </MarketingSubPage>
  );
}
