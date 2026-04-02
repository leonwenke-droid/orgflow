import Link from "next/link";
import { OrgFlowLogoMark } from "../brand/OrgFlowLogoMark";

export function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-logo">
              <div className="logo-mark text-white" aria-hidden>
                <OrgFlowLogoMark className="h-[14px] w-[14px]" />
              </div>
              <span className="footer-logo-text">OrgFlow</span>
            </div>
            <div className="footer-tagline">
              Organisation, die wirklich funktioniert — für Vereine, Schulen, NGOs und mehr.
            </div>
          </div>

          <div className="footer-col">
            <h4>Produkt</h4>
            <Link href="/features">Features</Link>
            <Link href="/preise">Preise</Link>
            <Link href="/changelog">Changelog</Link>
            <Link href="/roadmap">Roadmap</Link>
          </div>
          <div className="footer-col">
            <h4>Ressourcen</h4>
            <Link href="/docs">Dokumentation</Link>
            <Link href="/docs/api">API</Link>
            <Link href="/status">Status</Link>
            <Link href="/blog">Blog</Link>
          </div>
          <div className="footer-col">
            <h4>Unternehmen</h4>
            <Link href="/about">Über uns</Link>
            <Link href="/contact">Kontakt</Link>
            <a href="mailto:hello@orgflow.de">hello@orgflow.de</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 OrgFlow · LYNIQ Media · Gehostet in Deutschland</span>
          <div className="footer-legal">
            <Link href="/privacy">Datenschutz</Link>
            <Link href="/imprint">Impressum</Link>
            <Link href="/terms">Nutzungsbedingungen</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
