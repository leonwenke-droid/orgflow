import type { Metadata } from "next";
import { MarketingSubPage } from "../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "Status – OrgFlow",
  description: "Verfügbarkeit der OrgFlow-Web-App und geplante Wartungsfenster.",
  robots: { index: true, follow: true },
};

export default function StatusPage() {
  return (
    <MarketingSubPage
      eyebrow="Ressourcen"
      title="Systemstatus"
      lead="Alle OrgFlow-Kernservices sind derzeit erreichbar. Bei Störungen aktualisieren wir diese Seite und informieren betroffene Organisationen nach Möglichkeit direkt."
    >
      <div className="subpage-card" style={{ marginTop: "0.5rem" }}>
        <p style={{ margin: 0, color: "var(--green-dark)", fontWeight: 600 }}>
          ● Alle Systeme betriebsbereit
        </p>
        <p style={{ margin: "10px 0 0", fontSize: "14px" }}>
          Web-App, Anmeldung und API-Antworten werden kontinuierlich überwacht. Hosting-Standort: Deutschland.
        </p>
      </div>

      <h2>Komponenten</h2>
      <ul>
        <li>
          <strong>Website &amp; Marketing</strong> — erreichbar
        </li>
        <li>
          <strong>Anwendung (App)</strong> — erreichbar
        </li>
        <li>
          <strong>Datenbank &amp; Dateiablage</strong> — erreichbar
        </li>
        <li>
          <strong>E-Mail (Transaktional)</strong> — erreichbar (Zustellung kann je nach Provider minutenweise variieren)
        </li>
      </ul>

      <h2>Wartung</h2>
      <p>
        Gelegentliche Wartungsfenster werden möglichst außerhalb typischer Vereins-Abendzeiten geplant. Ankündigungen
        erscheinen hier und — wenn nötig — als Hinweis nach der Anmeldung in der App.
      </p>

      <h2>Incident melden</h2>
      <p>
        Wenn etwas nicht funktioniert, obwohl hier &quot;betriebsbereit&quot; steht, schreibt bitte an{" "}
        <a href="mailto:info@lyniqmedia.com">info@lyniqmedia.com</a> mit Zeitpunkt, betroffener Organisation (Slug) und
        kurzer Fehlerbeschreibung.
      </p>
    </MarketingSubPage>
  );
}
