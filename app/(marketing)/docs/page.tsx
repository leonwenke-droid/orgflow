import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSubPage } from "../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "Dokumentation – OrgFlow",
  description: "Erste Schritte mit OrgFlow: Organisation anlegen, Mitglieder einladen, Aufgaben und Schichten nutzen.",
  robots: { index: true, follow: true },
};

export default function DocsPage() {
  return (
    <MarketingSubPage
      eyebrow="Ressourcen"
      title="Dokumentation"
      lead="Kurze Anleitungen für Admins und aktive Mitglieder. Detaillierte API-Hinweise findet ihr im Bereich API."
    >
      <h2>Erste Schritte</h2>
      <ol>
        <li>
          <strong>Organisation anlegen</strong> über &quot;Kostenlos starten&quot; und den geführten Flow abschließen.
        </li>
        <li>
          <strong>Team oder Gremium anlegen</strong>, damit Aufgaben und Schichten zugeordnet werden können.
        </li>
        <li>
          <strong>Mitglieder einladen</strong> per Link oder Einladung — jede Person meldet sich mit eigenem Konto an.
        </li>
        <li>
          <strong>Erste Aufgabe oder Schicht</strong> im Admin-Bereich anlegen; Mitglieder sehen ihre Punkte im Dashboard.
        </li>
      </ol>

      <h2>Kernkonzepte</h2>
      <h3>Organisation</h3>
      <p>
        Eure Organisation ist der übergeordnete Rahmen: Mitglieder, Teams, Aufgaben, Schichten, Ressourcen und
        Finanzeinträge gehören dazu. Mehrere Organisationen pro Nutzerkonto sind möglich (z.&nbsp;B. Verein und Schule).
      </p>
      <h3>Aufgaben (Tasks)</h3>
      <p>
        Aufgaben haben einen Status (offen, in Arbeit, erledigt …), können Teams zugeordnet und mit Fälligkeit
        versehen werden. Nachweise lassen sich anhängen, wenn eure Organisation das vorsieht.
      </p>
      <h3>Schichten (Shifts)</h3>
      <p>
        Schichten hängen an Terminen oder Events. Mitglieder können sich eintragen oder von Admins zugewiesen werden;
        Kapazitäten und Check-in unterstützen den Ablauf vor Ort.
      </p>
      <h3>Finanzen / Kasse</h3>
      <p>
        Einfache Kassenführung und Exporte für eure Dokumentation — Umfang und Kategorien sind pro Organisation
        konfigurierbar.
      </p>

      <h2>Datenschutz &amp; Hosting</h2>
      <p>
        Wir hosten OrgFlow in Deutschland und behandeln personenbezogene Daten gemäß unserer{" "}
        <Link href="/privacy">Datenschutzerklärung</Link>. Nutzungsregeln stehen in den{" "}
        <Link href="/terms">Nutzungsbedingungen</Link>.
      </p>

      <h2>API für Entwickler</h2>
      <p>
        Übersicht zu Authentifizierung und Schnittstellen:{" "}
        <Link href="/docs/api">API-Dokumentation</Link>.
      </p>
    </MarketingSubPage>
  );
}
