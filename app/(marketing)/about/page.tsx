import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSubPage } from "../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "Über uns – OrgFlow",
  description: "OrgFlow wird von LYNIQ Media entwickelt — Organisationstool für Vereine, Schulen und NGOs.",
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return (
    <MarketingSubPage
      eyebrow="Unternehmen"
      title="Über OrgFlow"
      lead="OrgFlow hilft Organisationen, die auf Menschen zählen: klarer als Gruppenchat, leichter als Tabellen-Wirrwarr — mit Respekt vor Datenschutz und Alltagstauglichkeit."
    >
      <h2>Warum es OrgFlow gibt</h2>
      <p>
        Vereine, Schulen und NGOs organisieren sich oft mit viel Herzblut und wenig IT-Budget. Gleichzeitig steigen die
        Erwartungen: transparente Schichten, nachvollziehbare Aufgaben, saubere Kassenführung. OrgFlow vereint diese
        Bausteine in einem Werkzeug — ohne Enterprise-Komplexität.
      </p>

      <h2>LYNIQ Media</h2>
      <p>
        OrgFlow ist ein Produkt von <strong>LYNIQ Media</strong> (Inhaber: Leon Wenke). Wir entwickeln Software mit Fokus
        auf klare Nutzeroberflächen und nachhaltigen Betrieb. Hosting und Verarbeitung personenbezogener Daten erfolgen
        in Deutschland; Details findet ihr im <Link href="/privacy">Datenschutzhinweis</Link> und im{" "}
        <Link href="/imprint">Impressum</Link>.
      </p>

      <h2>Werte</h2>
      <ul>
        <li>
          <strong>Zuverlässigkeit</strong> — eure Planung darf nicht an einem Tool scheitern.
        </li>
        <li>
          <strong>Respekt vor Freiwilligen</strong> — Software soll unterstützen, nicht zusätzlich stressen.
        </li>
        <li>
          <strong>Transparenz</strong> — offene Kommunikation zu Preisen, Status und Änderungen (
          <Link href="/changelog">Changelog</Link>, <Link href="/roadmap">Roadmap</Link>).
        </li>
      </ul>

      <h2>Kontakt</h2>
      <p>
        Fragen, Support und Partnerschaften:{" "}
        <a href="mailto:info@lyniqmedia.com">info@lyniqmedia.com</a>
        <br />
        Weitere Infos unter{" "}
        <a href="https://www.lyniqmedia.com" target="_blank" rel="noopener noreferrer">
          lyniqmedia.com
        </a>
      </p>
    </MarketingSubPage>
  );
}
