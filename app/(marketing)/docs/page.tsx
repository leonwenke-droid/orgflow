import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSubPage } from "../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "Dokumentation – OrgFlow",
  description: "Erste Schritte mit OrgFlow: Organisation anlegen, Mitglieder einladen, Aufgaben, Schichten, Events und Finanzen nutzen.",
  robots: { index: true, follow: true },
};

export default function DocsPage() {
  return (
    <MarketingSubPage
      eyebrow="Ressourcen"
      title="Dokumentation"
      lead="Kurze Anleitungen für Admins und aktive Mitglieder — von der ersten Organisation bis zum QR-Check-in."
    >
      <h2>Erste Schritte</h2>
      <ol>
        <li>
          <strong>Organisation anlegen</strong> über &quot;Kostenlos starten&quot; — der geführte
          Wizard fragt Name, Typ und gewünschte Module ab. Fortschritt wird gespeichert,
          falls eine E-Mail-Verifikation dazwischenkommt.
        </li>
        <li>
          <strong>Teams anlegen</strong> unter Admin → Teams, damit Aufgaben und Schichten
          Gruppen zugeordnet werden können.
        </li>
        <li>
          <strong>Mitglieder einladen</strong> per Einladungslink (kopieren &amp; teilen),
          WhatsApp-Direkttext oder per Excel-Import für größere Gruppen.
        </li>
        <li>
          <strong>Erste Aufgabe oder Schicht anlegen</strong> im Admin-Bereich.
          Mitglieder sehen sofort ihre zugewiesenen Aufgaben und Schichten im Dashboard.
        </li>
      </ol>

      <h2>Kernkonzepte</h2>

      <h3>Organisation</h3>
      <p>
        Jede Organisation ist ein isolierter Bereich mit eigenen Mitgliedern, Rollen,
        Modulen und Daten. Ein Nutzerkonto kann mehreren Organisationen angehören —
        mit getrennten Rollen pro Organisation. Module (Aufgaben, Schichten, Finanzen,
        Ressourcen, Engagement, Events) können pro Organisation ein- und ausgeschaltet werden.
      </p>

      <h3>Rollen</h3>
      <p>
        Fünf Rollen steuern den Zugriff: <strong>Owner</strong> hat volle Kontrolle,
        <strong>Admin</strong> verwaltet Mitglieder und alle Module,
        <strong>TeamLead</strong> verwaltet Aufgaben im eigenen Team,
        <strong>Member</strong> sieht und bearbeitet eigene Aufgaben und Schichten,
        <strong>Viewer</strong> hat reinen Lesezugriff.
      </p>

      <h3>Aufgaben</h3>
      <p>
        Aufgaben haben Status (offen, in Arbeit, erledigt), Fälligkeit, Team-Zuordnung
        und optionale Nachweispflicht. Zuweisungsmodi: manuell, automatisch, Rotation
        oder zufällig. Mitglieder können offene Aufgaben selbst übernehmen wenn
        &quot;claimable&quot; aktiviert ist. Das Kanban-Board zeigt alle Aufgaben
        nach Status gruppiert.
      </p>

      <h3>Schichten</h3>
      <p>
        Schichten haben Datum, Start-/Endzeit, Ort, Kapazität und Zuweisungsmodus.
        Modi: Selbsteintragung, automatisch, Rotation (nach Engagement-Score) oder
        fest durch Admin. Anwesenheitsmodus pro Schicht: QR-Check-in, nur Admin
        oder keine Erfassung. Mitglieder können Schichten offiziell abgeben —
        Übergaben werden vom Admin genehmigt.
      </p>

      <h3>Veranstaltungen</h3>
      <p>
        Events bündeln Aufgaben, Schichten und Ressourcen zu einer Veranstaltung.
        Das Event-Dashboard zeigt Slot-Auslastung, offene Aufgaben und beschaffte
        Materialien auf einen Blick. Schichten und Aufgaben können beim Anlegen
        direkt einem Event zugeordnet werden.
      </p>

      <h3>Finanzen</h3>
      <p>
        Einfache Kassenführung: Einnahmen und Ausgaben per Formular oder
        Excel-Import erfassen. Kategorisierte Einträge, laufender Kassenstand,
        CSV-Export für externe Auswertung. Umfang und Kategorien sind pro
        Organisation konfigurierbar.
      </p>

      <h3>Engagement-Score</h3>
      <p>
        Optionales Punktesystem: Punkte für erledigte Schichten, Aufgaben und
        Ressourcen-Beiträge. Gewichtung pro Kategorie konfigurierbar. Rangliste
        im Admin-Bereich, persönlicher Score im Mitgliedsprofil. Admins können
        Punkte manuell korrigieren; alle Änderungen sind im Audit-Log sichtbar.
      </p>

      <h2>Einladungen &amp; Onboarding</h2>
      <p>
        Drei Wege, um Mitglieder aufzunehmen: Einladungslink (zeitlich begrenzt,
        klickbar), WhatsApp-Direkttext mit Link, oder Excel-Import für Gruppen.
        Neue Mitglieder setzen beim ersten Besuch ein Passwort und landen
        direkt im Dashboard. Einladungen können widerrufen oder neu ausgestellt werden.
      </p>

      <h2>Schichten &amp; Check-in</h2>
      <p>
        Ablauf von Zuweisung bis QR-Check-in und Admin-Bestätigung:{" "}
        <Link href="/docs/shift-checkin">Schichten &amp; Anwesenheit</Link>.
      </p>

      <h2>API für Entwickler</h2>
      <p>
        Übersicht zu Authentifizierung und Schnittstellen:{" "}
        <Link href="/docs/api">API-Dokumentation</Link>.
      </p>

      <h2>Datenschutz &amp; Hosting</h2>
      <p>
        OrgFlow wird in Deutschland gehostet und verarbeitet personenbezogene Daten
        gemäß DSGVO. Details in der{" "}
        <Link href="/privacy">Datenschutzerklärung</Link> und den{" "}
        <Link href="/terms">Nutzungsbedingungen</Link>.
        Automatisierte Löschroutinen entfernen personenbezogene Daten nach
        Deaktivierung fristgerecht.
      </p>
    </MarketingSubPage>
  );
}
