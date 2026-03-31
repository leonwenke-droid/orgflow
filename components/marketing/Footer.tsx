import Link from "next/link";

export function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-logo">
              <div className="logo-mark" aria-hidden>
                <svg viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="5" height="5" rx="1.5" fill="white" />
                  <rect x="8" y="1" width="5" height="5" rx="1.5" fill="white" opacity=".5" />
                  <rect x="1" y="8" width="5" height="5" rx="1.5" fill="white" opacity=".5" />
                  <rect x="8" y="8" width="5" height="5" rx="1.5" fill="white" opacity=".3" />
                </svg>
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

