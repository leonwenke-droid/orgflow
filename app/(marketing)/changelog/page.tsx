import type { Metadata } from "next";
import { MarketingSubPage } from "../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "Changelog – OrgFlow",
  description: "Alle Updates und Verbesserungen an OrgFlow: Aufgaben, Schichten, Benachrichtigungen, Finanzen und mehr.",
  robots: { index: true, follow: true },
};

export default function ChangelogPage() {
  return (
    <MarketingSubPage
      eyebrow="Produkt"
      title="Changelog"
      lead="Ausgewählte Updates und Verbesserungen — chronologisch dokumentiert. Kleinere Bugfixes und interne Anpassungen erscheinen nicht immer einzeln."
    >
      <div className="subpage-changelog">

        <article>
          <time dateTime="2026-04">April 2026</time>
          <h2>E-Mail-Benachrichtigungen</h2>
          <p>
            Vollständiges transaktionales E-Mail-System: Mitglieder erhalten sofortige Benachrichtigungen
            bei Schicht- und Aufgabenzuweisungen — inklusive Veranstaltungsname, Datum, Uhrzeit und
            direktem Link ins Dashboard. Automatische 24-Stunden-Erinnerungen vor Schichten und
            Aufgaben-Deadlines. Passwort-Reset, Einladungs- und Signup-Bestätigungsmails
            laufen ebenfalls über das neue System und tragen durchgängig das OrgFlow-Design.
          </p>
        </article>

        <article>
          <time dateTime="2026-04">April 2026</time>
          <h2>Performance: schnellere Seitennavigation</h2>
          <p>
            Dashboard, Aufgaben und Schichten laden spürbar schneller. Organisationsdaten werden
            serverseitig gecacht und nur bei Änderungen invalidiert. Datenbank­abfragen beim
            Seitenaufruf laufen jetzt parallel statt sequentiell — das reduziert die
            Wartezeit vor dem ersten sichtbaren Inhalt deutlich.
          </p>
        </article>

        <article>
          <time dateTime="2026-04">April 2026</time>
          <h2>Schicht-Übergaben (Transfer Queue)</h2>
          <p>
            Mitglieder können Schichten offiziell abgeben: eine Übergabeanfrage landet in einer
            Admin-Warteschlange und wird erst nach Genehmigung wirksam. Kein unkontrolliertes
            Tauschen mehr — jede Übergabe ist nachvollziehbar und revisionssicher.
          </p>
        </article>

        <article>
          <time dateTime="2026-04">April 2026</time>
          <h2>Abwesenheitsverwaltung & Rotationssperre</h2>
          <p>
            Admins können Abwesenheiten für Mitglieder eintragen und genehmigen. Genehmigte
            Abwesenheiten blockieren automatisch Schichtzuweisungen im betroffenen Zeitraum —
            das Rotationssystem berücksichtigt dies bei der nächsten automatischen Verteilung.
            Zeitzonen werden korrekt nach Europe/Berlin aufgelöst.
          </p>
        </article>

        <article>
          <time dateTime="2026-03">März 2026</time>
          <h2>Rotationssystem für faire Schichtzuteilung</h2>
          <p>
            Schichten können per Rotation automatisch zugeteilt werden: wer zuletzt wenig
            beigetragen hat, wird bevorzugt eingeteilt. Das Gewicht basiert auf dem
            Engagement-Score und einem konfigurierbaren Decay-Faktor. Admins sehen eine
            Rotations-Vorschau vor dem Zuteilen und können die Gewichtung pro Organisation
            anpassen.
          </p>
        </article>

        <article>
          <time dateTime="2026-03">März 2026</time>
          <h2>Multi-Org-Mitgliedschaft</h2>
          <p>
            Ein Nutzerkonto kann jetzt Mitglied in mehreren Organisationen gleichzeitig sein —
            mit getrennten Rollen, Berechtigungen und Engagement-Scores pro Organisation.
            Der Dashboard-Hub zeigt alle Organisationen nach Login auf einen Blick.
            Einladungslinks und Zugriffsrechte sind sauber org-isoliert.
          </p>
        </article>

        <article>
          <time dateTime="2026-03">März 2026</time>
          <h2>Veranstaltungen (Events)</h2>
          <p>
            Events bündeln zugehörige Aufgaben, Schichten und Ressourcen an einem Ort. Admins
            sehen auf einen Blick wie viele Schicht-Slots besetzt sind, wie viele Aufgaben noch
            offen sind und welche Materialien beschafft wurden — alles direkt aus dem
            Event-Dashboard. Schichten und Aufgaben können beim Anlegen direkt einer
            Veranstaltung zugeordnet werden.
          </p>
        </article>

        <article>
          <time dateTime="2026-03">März 2026</time>
          <h2>Organisationen & Einladungen</h2>
          <p>
            Vereinfachtes Onboarding für neue Organisationen: der geführte Wizard speichert
            den Fortschritt über E-Mail-Verifikation hinweg. Klarere Einladungslinks für
            Mitglieder, WhatsApp-Direkttext zum Teilen, und verbesserte Hinweise bei
            fehlenden Berechtigungen. Admins sehen relevante nächste Schritte direkt
            im Dashboard.
          </p>
        </article>

        <article>
          <time dateTime="2026-03">März 2026</time>
          <h2>Billing: Team- & Pro-Tarife mit Stripe</h2>
          <p>
            Direkte Stripe-Integration: Organisationen können auf Team (bis 49 Mitglieder,
            29&nbsp;€/Monat) oder Pro (unbegrenzt, 49&nbsp;€/Monat) upgraden — mit 14-tägiger
            kostenloser Testphase vor der ersten Abbuchung. Abonnement-Verwaltung,
            Rechnungen und Zahlungsdetails sind über das Stripe-Kundenportal erreichbar.
            Feature-Gates greifen in Echtzeit nach Plan-Änderung.
          </p>
        </article>

        <article>
          <time dateTime="2026-02">Februar 2026</time>
          <h2>QR-Check-in für Schichten</h2>
          <p>
            Jeder zugewiesenen Person wird ein persönlicher Check-in-Link und QR-Code generiert.
            Zwei Modi: Mitglied zeigt den Code (Admin scannt mit Kamera im Admin-Bereich) oder
            Mitglied öffnet den Link selbst. QR-Codes können als PNG exportiert werden.
            Anwesenheitserfassung wird pro Schicht konfiguriert — QR, nur Admin oder keine
            Erfassung. Check-ins fließen in Engagement-Auswertungen ein.
          </p>
        </article>

        <article>
          <time dateTime="2026-02">Februar 2026</time>
          <h2>Aufgaben: Kanban-Board & Auto-Zuweisung</h2>
          <p>
            Komplett überarbeitetes Aufgaben-Board: Drag-and-Drop zwischen Status-Spalten,
            Fälligkeit, Team-Zuordnung und Nachweise in einer Ansicht. Neue Zuweisungsmodi:
            manuell, automatisch, Rotation oder zufällig. Mitglieder können offene Aufgaben
            selbst übernehmen (claimable). Soft-Delete mit Papierkorb für versehentlich
            gelöschte Aufgaben.
          </p>
        </article>

        <article>
          <time dateTime="2026-02">Februar 2026</time>
          <h2>Schichtplan & Kalender</h2>
          <p>
            Überarbeitete Wochenansicht mit stabilerem Verhalten auf Mobilgeräten. Klarere
            Status-Badges (belegt, frei, abgesagt). Slot-Auslastung in Echtzeit. Exporte
            für Teilnehmerlisten. Navigation-Badge zeigt offene Schicht-Slots direkt in der
            Seitenleiste.
          </p>
        </article>

        <article>
          <time dateTime="2026-01">Januar 2026</time>
          <h2>Design-System & Dark Mode</h2>
          <p>
            Vollständige Überarbeitung des UI-Token-Systems: konsistente Farben, Kontraste
            und Eingabefelder in Hell- und Dunkelmodus. Neue Sidebar-Navigation mit
            rollen­basierter Sichtbarkeit, Mobile-Hamburger-Menü und PWA-Manifest für
            Installation auf dem Homescreen.
          </p>
        </article>

        <article>
          <time dateTime="2026-01">Januar 2026</time>
          <h2>Engagement-Score</h2>
          <p>
            Optionales Punktesystem pro Organisation: Punkte für erledigte Schichten,
            Aufgaben und Ressourcen-Beiträge. Konfigurierbares Gewicht pro Kategorie.
            Rangliste im Dashboard, persönlicher Score im Mitgliedsprofil. Admins können
            Punkte manuell korrigieren und die Auswertung als Excel exportieren.
          </p>
        </article>

        <article>
          <time dateTime="2026-01">Januar 2026</time>
          <h2>Mitglieder-Import & Rollen</h2>
          <p>
            Mitglieder per Excel-Vorlage importieren (Name, E-Mail, Team, Rolle). Bulk-Einladung
            beim Import. Rollenbasiertes Zugriffsmodell: Owner, Admin, TeamLead, Member, Viewer —
            mit feingranularen Berechtigungen pro Bereich. Audit-Log für alle
            Admin-Aktionen.
          </p>
        </article>

      </div>

      <p className="subpage-meta" style={{ marginTop: "2.5rem" }}>
        Fragen zu einem Eintrag?{" "}
        <a href="mailto:info@lyniqmedia.com">info@lyniqmedia.com</a>
      </p>
    </MarketingSubPage>
  );
}
