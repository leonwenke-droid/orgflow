import type { Metadata } from "next";
import { MarketingSubPage } from "../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "Changelog – OrgFlow",
  description: "Neuigkeiten und Verbesserungen an OrgFlow: Aufgaben, Schichten, Finanzen und mehr.",
  robots: { index: true, follow: true },
};

export default function ChangelogPage() {
  return (
    <MarketingSubPage
      eyebrow="Produkt"
      title="Changelog"
      lead="Hier dokumentieren wir ausgewählte Updates und Verbesserungen. Kleinere Fixes und interne Anpassungen erscheinen nicht immer einzeln."
    >
      <div className="subpage-changelog">
        <article>
          <time dateTime="2026-04">April 2026</time>
          <h2>E-Mail-Benachrichtigungen</h2>
          <p>
            Vollständiges E-Mail-System über n8n: Mitglieder erhalten sofortige Benachrichtigungen bei Schicht- und
            Aufgabenzuweisungen, 24-Stunden-Erinnerungen vor Schichten und Aufgaben-Deadlines sowie Einladungs- und
            Passwort-Reset-Mails — alle im einheitlichen OrgFlow-Design.
          </p>
        </article>
        <article>
          <time dateTime="2026-04">April 2026</time>
          <h2>Veranstaltungen (Events)</h2>
          <p>
            Veranstaltungen bündeln zugehörige Aufgaben und Schichten an einem Ort. Admins sehen auf einen Blick, wie viele
            Plätze besetzt sind und welche Aufgaben noch offen sind — direkt aus dem Event-Dashboard.
          </p>
        </article>
        <article>
          <time dateTime="2026-04">April 2026</time>
          <h2>Performance &amp; Ladezeiten</h2>
          <p>
            Parallele Datenbankabfragen und Caching der Organisations-Metadaten reduzieren die Ladezeiten deutlich.
            Seitennavigation innerhalb der App ist spürbar schneller.
          </p>
        </article>
        <article>
          <time dateTime="2026-03">März 2026</time>
          <h2>Rotationssystem für Schichten</h2>
          <p>
            Automatische faire Zuteilung von Schichten nach Rotationsprinzip: wer zuletzt wenig beigetragen hat, wird
            bevorzugt eingeteilt. Admins können die Rotations-Gewichtung pro Organisation konfigurieren.
          </p>
        </article>
        <article>
          <time dateTime="2026-03">März 2026</time>
          <h2>Multi-Org-Mitgliedschaft</h2>
          <p>
            Ein Nutzerkonto kann jetzt Mitglied in mehreren Organisationen gleichzeitig sein — mit getrennten Rollen und
            Berechtigungen pro Organisation.
          </p>
        </article>
        <article>
          <time dateTime="2026-04">April 2026</time>
          <h2>Design &amp; Lesbarkeit</h2>
          <p>
            Überarbeitetes Farb- und Oberflächensystem für Hell- und Dunkelmodus: konsistente Kontraste in der App,
            klarere Eingabefelder und Status-Badges. Die Marketing-Website nutzt dieselben Designprinzipien wie das Produkt.
          </p>
        </article>
        <article>
          <time dateTime="2026-03">März 2026</time>
          <h2>Organisationen &amp; Einladungen</h2>
          <p>
            Vereinfachtes Onboarding für neue Organisationen, klarere Einladungslinks für Mitglieder und verbesserte
            Hinweise bei fehlenden Berechtigungen. Admins sehen relevante nächste Schritte direkt im Dashboard.
          </p>
        </article>
        <article>
          <time dateTime="2026-02">Februar 2026</time>
          <h2>Schichtplan &amp; Kalender</h2>
          <p>
            Stabilere Wochenansicht, bessere Darstellung auf Mobilgeräten und klarere Status für Schichten (z.&nbsp;B.
            belegt, frei, abgesagt). Exporte für Teilnehmerlisten wurden robuster gemacht.
          </p>
        </article>
        <article>
          <time dateTime="2026-01">Januar 2026</time>
          <h2>Aufgaben &amp; Nachweise</h2>
          <p>
            Aufgaben können mit Fälligkeit und Team-Zuordnung geführt werden; wo vorgesehen, lassen sich Nachweise
            anhängen. Mitglieder sehen ihre offenen Aufgaben gebündelt auf einer Seite.
          </p>
        </article>
      </div>
      <p className="subpage-meta" style={{ marginTop: "2.5rem" }}>
        Fragen zu einem Eintrag? Schreib uns an{" "}
        <a href="mailto:info@lyniqmedia.com">info@lyniqmedia.com</a>.
      </p>
    </MarketingSubPage>
  );
}
