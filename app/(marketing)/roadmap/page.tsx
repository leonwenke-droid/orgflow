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
            <strong>Erweiterte Berechtigungen</strong> — feinere Rollen für Admins und
            Teams (z.&nbsp;B. nur Lesen, nur Schichten).
          </span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--soon">In Arbeit</span>
          <span>
            <strong className="text-text-primary">Benachrichtigungen</strong> — E-Mail- und In-App-Hinweise für
            Schichten, Aufgaben und Einladungen.
          </span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--soon">Geplant</span>
          <span>
            <strong>Kalender-Feeds</strong> — iCal-Abonnement für Schichten und Termine.
          </span>
        </div>
      </div>

      <h2>Geplant (mittelfristig)</h2>
      <ul>
        <li>Mobile Web-Optimierung weiter ausbauen; native Apps evaluieren.</li>
        <li>Integrationen (z.&nbsp;B. Slack, Microsoft Teams) für Status-Updates.</li>
        <li>API-Erweiterungen für ausgewählte Partner und eigene Automatisierungen.</li>
        <li>Mehrsprachige Oberfläche vereinheitlichen (DE/EN) in allen Bereichen.</li>
      </ul>

      <h2>Bereits live (Auswahl)</h2>
      <div className="subpage-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Aufgaben, Schichten, Mitglieder, Teams (Gremien), Ressourcen, Finanz-/Kassenbereich</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Engagement-Punkte und Auswertungen (optional pro Organisation)</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Einladungslinks, Check-in für Schichten, Exporte</span>
        </div>
      </div>

      <p className="subpage-meta" style={{ marginTop: "2rem" }}>
        Wunsch oder Feedback?{" "}
        <a href="mailto:hello@orgflow.de">hello@orgflow.de</a>
      </p>
    </MarketingSubPage>
  );
}
