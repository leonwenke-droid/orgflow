import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSubPage } from "../../../components/marketing/MarketingSubPage";

export const metadata: Metadata = {
  title: "Kontakt – OrgFlow",
  description: "OrgFlow erreichen: Produktfragen, Support und geschäftliche Anfragen.",
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <MarketingSubPage
      eyebrow="Unternehmen"
      title="Kontakt"
      lead="Wir freuen uns auf eure Nachricht — ob Demo-Wunsch, Support oder Presse. Antworten in der Regel innerhalb von ein bis zwei Werktagen."
    >
      <h2>OrgFlow (Produkt)</h2>
      <div className="subpage-card">
        <p style={{ margin: 0 }}>
          <strong>E-Mail</strong>
          <br />
          <a href="mailto:hello@orgflow.de">hello@orgflow.de</a>
        </p>
        <p style={{ margin: "12px 0 0", fontSize: "14px" }}>
          Bitte Organisation (Name oder Kurzlink) und kurze Beschreibung des Anliegens angeben — bei technischen
          Problemen hilft ein Screenshot oder die ungefähre Uhrzeit.
        </p>
      </div>

      <h2>LYNIQ Media (Rechnungen &amp; Vertrag)</h2>
      <div className="subpage-card">
        <p style={{ margin: 0 }}>
          Leon Wenke · LYNIQ Media
          <br />
          Alte Poststraße 17a
          <br />
          26835 Holtland, Deutschland
        </p>
        <p style={{ margin: "12px 0 0" }}>
          <a href="mailto:info@lyniqmedia.com">info@lyniqmedia.com</a>
          <br />
          <a href="https://www.lyniqmedia.com" target="_blank" rel="noopener noreferrer">
            www.lyniqmedia.com
          </a>
        </p>
      </div>

      <h2>Rechtliches &amp; Datenschutz</h2>
      <p>
        <Link href="/imprint">Impressum</Link>
        {" · "}
        <Link href="/privacy">Datenschutz</Link>
        {" · "}
        <Link href="/terms">Nutzungsbedingungen</Link>
      </p>
    </MarketingSubPage>
  );
}
