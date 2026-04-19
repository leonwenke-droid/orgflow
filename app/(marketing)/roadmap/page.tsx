import type { Metadata } from "next";
import { MarketingSubPage } from "../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "Roadmap – OrgFlow",
  description: "Geplante und laufende Entwicklung an OrgFlow: Mobile App, Kalender-Feeds, Integrationen und mehr.",
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
            Teams (z.&nbsp;B. nur Lesen, nur Schichten sehen, nur eigene Aufgaben).
          </span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--soon">Geplant</span>
          <span>
            <strong>Mobile App</strong> — Native iOS- und Android-App für Mitglieder:
            Schichten einsehen, QR-Check-in, Aufgaben übernehmen, Benachrichtigungen.
          </span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--soon">Geplant</span>
          <span>
            <strong>Kalender-Feeds</strong> — iCal-Abonnement für Schichten und Events,
            kompatibel mit Google Calendar, Apple Kalender und Outlook.
          </span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--soon">Geplant</span>
          <span>
            <strong>Öffentliche Event-Seiten</strong> — Veranstaltungen mit externem
            Anmeldelink für Nicht-Mitglieder; optionale Warteliste.
          </span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--soon">Geplant</span>
          <span>
            <strong>Wiederkehrende Schichten</strong> — Serien für regelmäßige Termine
            (wöchentlich, monatlich) ohne manuelles Neu-Anlegen.
          </span>
        </div>
      </div>

      <h2>Geplant (mittelfristig)</h2>
      <ul>
        <li>Integrationen (z.&nbsp;B. Slack, Microsoft Teams) für automatische Status-Updates bei Schicht- und Aufgabenänderungen.</li>
        <li>API-Erweiterungen für ausgewählte Partner und eigene Automatisierungen (Webhooks, REST).</li>
        <li>Erweiterte Exportformate: PDF-Berichte, DATEV-kompatibler Finanz-Export.</li>
        <li>Push-Benachrichtigungen (Web Push / App-Benachrichtigungen) zusätzlich zu E-Mail.</li>
        <li>Mehrsprachige Oberfläche in allen Bereichen vollständig vereinheitlichen.</li>
      </ul>

      <h2>Bereits live (vollständige Übersicht)</h2>
      <div className="subpage-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Aufgaben mit Kanban-Board, Fälligkeit, Team-Zuordnung, Nachweisen und Soft-Delete</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Schichtplanung: Wochenansicht, Slot-Verwaltung, Auto-Zuweisung, Rotation, Selbsteintragung</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Veranstaltungen (Events) mit verknüpften Aufgaben, Schichten und Ressourcen</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>QR-Check-in für Schichten (Selbst-Check-in, Admin-Scanner, PNG-Export)</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Rotationssystem: faire Schichtzuteilung nach Engagement-Score mit Decay</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Schicht-Übergaben: genehmigungspflichtige Transfer-Queue für Schicht-Abgaben</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Abwesenheitsverwaltung mit Admin-Genehmigung und automatischer Rotationssperre</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>E-Mail-Benachrichtigungen: Einladung, Zuweisung, 24h-Erinnerung, Passwort-Reset</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Engagement-Score: Punkte, Rangliste, manuelle Korrektur, Excel-Export (optional pro Org)</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Finanzen / Kasse: Excel-Import, CSV-Export, kategorisierte Einträge, Kassenstand</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Ressourcen / Materialien: Beschaffung, Status-Tracking, Event-Verknüpfung</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Mitglieder: Excel-Import, Einladungslinks, WhatsApp-Direkttext, Rollenmodell (5 Rollen)</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Multi-Org-Mitgliedschaft: ein Konto, mehrere Organisationen mit getrennten Rollen</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Billing: Stripe-Integration mit Team / Pro, 14-Tage-Testphase, Kundenportal</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Dark Mode, DE/EN Sprachauswahl, Mobile-optimierte Oberfläche, PWA-Manifest</span>
        </div>
        <div className="subpage-roadmap-row">
          <span className="subpage-pill subpage-pill--live">Live</span>
          <span>Sicherheit: DSGVO-Löschcron, Audit-Log, RLS, Sentry-Monitoring, Rate-Limiting</span>
        </div>
      </div>

      <p className="subpage-meta" style={{ marginTop: "2rem" }}>
        Wunsch oder Feedback?{" "}
        <a href="mailto:info@lyniqmedia.com">info@lyniqmedia.com</a>
      </p>
    </MarketingSubPage>
  );
}
