import type { Metadata } from "next";
import { MarketingSubPage } from "../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "Roadmap – OrgFlow",
  description: "Geplante und laufende Entwicklung: Mobile Apps, Integrationen, Rollen und mehr.",
  robots: { index: true, follow: true },
};

export default function RoadmapPage() {
  return (
    <MarketingSubPage
      eyebrow="Produkt"
      title="Roadmap"
      lead="OrgFlow wächst mit euren Vereinen, Schulen und Teams. Die Reihenfolge kann sich je nach Feedback verschieben — sag uns gern, was euch am meisten bringt."
      wide
    >
      <h2>In Arbeit oder kurz vor Release</h2>
      <div className="subpage-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--soon">In Arbeit</span>
          <span>
            <strong>Erweiterte Berechtigungen</strong> — feinere Rollen für Admins und Teams (z.&nbsp;B. nur Lesen, nur
            Schichten).
          </span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--soon">Geplant</span>
          <span>
            <strong>Kalender-Feeds</strong> — iCal-Abonnement für Schichten und Termine.
          </span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--soon">Geplant</span>
          <span>
            <strong>Mobile App</strong> — Native iOS- und Android-App für Mitglieder (Schichten einsehen, Check-in,
            Aufgaben).
          </span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--soon">Geplant</span>
          <span>
            <strong>Öffentliche Event-Seiten</strong> — Veranstaltungen mit externem Anmeldelink für Nicht-Mitglieder.
          </span>
        </div>
      </div>

      <h2>Geplant (mittelfristig)</h2>
      <ul>
        <li>Integrationen (z.&nbsp;B. Slack, Microsoft Teams) für Status-Updates.</li>
        <li>API-Erweiterungen für ausgewählte Partner und eigene Automatisierungen.</li>
        <li>Wiederkehrende Schichten und Aufgaben (Serien).</li>
        <li>Erweiterte Exportformate (PDF, DATEV-kompatibel).</li>
      </ul>

      <h2>Bereits live (Auswahl)</h2>
      <div className="subpage-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Aufgaben, Schichten, Mitglieder, Teams (Gremien), Ressourcen, Finanz-/Kassenbereich</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Veranstaltungen (Events) mit verknüpften Aufgaben und Schichten</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Engagement-Punkte und Auswertungen (optional pro Organisation)</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Einladungslinks, QR-Check-in für Schichten, Exporte (CSV, Excel)</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Rotationssystem für faire Schichtzuteilung</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>E-Mail-Benachrichtigungen: Einladung, Zuweisung, 24h-Erinnerung, Passwort-Reset</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Multi-Org-Mitgliedschaft (ein Konto, mehrere Organisationen)</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Dark Mode, DE/EN Sprachauswahl</span>
        </div>
      </div>

      <p className="subpage-meta" style={{ marginTop: "2rem" }}>
        Wunsch oder Feedback? <a href="mailto:info@lyniqmedia.com">info@lyniqmedia.com</a>
      </p>
    </MarketingSubPage>
  );
}
