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
            <a href="#features">Features</a>
            <a href="#pricing">Preise</a>
            <a href="#">Changelog</a>
            <a href="#">Roadmap</a>
          </div>
          <div className="footer-col">
            <h4>Ressourcen</h4>
            <a href="#">Dokumentation</a>
            <a href="#">API</a>
            <a href="#">Status</a>
            <a href="#">Blog</a>
          </div>
          <div className="footer-col">
            <h4>Unternehmen</h4>
            <a href="#">Über uns</a>
            <a href="#">Kontakt</a>
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

