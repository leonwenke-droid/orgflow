import type { Metadata } from "next";
import { MarketingSubPage } from "../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "Blog – OrgFlow",
  description: "Gedanken zu Organisation, Ehrenamt und digitaler Zusammenarbeit — vom OrgFlow-Team.",
  robots: { index: true, follow: true },
};

export default function BlogPage() {
  return (
    <MarketingSubPage
      eyebrow="Ressourcen"
      title="Blog"
      lead="Praxisnahe Artikel für Vereine, Schulen und NGOs. Neue Beiträge erscheinen unregelmäßig — den Feed verlinken wir künftig auch per RSS."
    >
      <article className="blog-card">
        <p className="subpage-meta">8. März 2026</p>
        <h2>
          <span>Warum eine gemeinsame Aufgabenliste nicht reicht</span>
        </h2>
        <p>
          Chat-Gruppen und Tabellen sind ein Start — sobald mehrere Teams parallel arbeiten, fehlen klare Zuständigkeiten,
          Fälligkeiten und Nachweise. OrgFlow bündelt Aufgaben, Schichten und Finanzen bewusst getrennt, aber an einer
          Stelle, damit niemand zwischen fünf Tools springen muss.
        </p>
      </article>

      <article className="blog-card">
        <p className="subpage-meta">12. Februar 2026</p>
        <h2>
          <span>Schichtplanung ohne Excel-Chaos</span>
        </h2>
        <p>
          Viele Vereine planen noch in geteilten Tabellen — Versionen überschreiben sich, wer zugesagt hat, geht unter.
          Eine zentrale Schichtverwaltung mit Kapazitäten und Check-in reduziert Doppelungen und macht den Ablauf am
          Veranstaltungstag entspannter.
        </p>
      </article>

      <article className="blog-card">
        <p className="subpage-meta">20. Januar 2026</p>
        <h2>
          <span>Engagement sichtbar machen — fair und motivierend</span>
        </h2>
        <p>
          Wer viel ehrenamtlich leistet, soll nicht unsichtbar bleiben. Punkte für erledigte Schichten und Aufgaben sind
          optional — Organisationen entscheiden selbst, ob und wie sie Motivation und Anerkennung nutzen, ohne den
          Fokus von der Gemeinschaft zu verlieren.
        </p>
      </article>

      <p className="subpage-meta">
        Themenvorschlag?{" "}
        <a href="mailto:hello@orgflow.de">hello@orgflow.de</a>
      </p>
    </MarketingSubPage>
  );
}
