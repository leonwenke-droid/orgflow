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
        <a href="mailto:hello@orgflow.de">hello@orgflow.de</a>.
      </p>
    </MarketingSubPage>
  );
}
