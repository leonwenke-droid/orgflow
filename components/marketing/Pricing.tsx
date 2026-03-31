import Link from "next/link";

export function Pricing() {
  return (
    <section className="pricing" id="pricing">
      <div className="container">
        <div className="pricing-head">
          <div className="section-label">Preise</div>
          <h2>Transparent. Fair. Skalierbar.</h2>
          <p>Für jede Organisationsgröße das passende Modell — ohne versteckte Kosten.</p>
        </div>

        <div className="pricing-grid">
          <div className="p-card reveal">
            <div className="p-tier">Starter</div>
            <div className="p-price">0 €</div>
            <div className="p-period">für immer kostenlos</div>
            <div className="p-desc">Für kleine Gruppen und erste Schritte.</div>
            <div className="p-divider" />
            <div className="p-features">
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Bis zu 25 Mitglieder
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Aufgaben &amp; Schichten
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                1 Organisation
              </div>
              <div className="p-feature" style={{ opacity: 0.45 }}>
                <svg className="p-check p-check-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="4" y1="8" x2="12" y2="8" />
                </svg>
                Finanzen &amp; Buchhaltung
              </div>
              <div className="p-feature" style={{ opacity: 0.45 }}>
                <svg className="p-check p-check-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="4" y1="8" x2="12" y2="8" />
                </svg>
                Engagement Score
              </div>
            </div>
            <Link href="/create-organisation" className="btn btn-outline" style={{ width: "100%", justifyContent: "center" }}>
              Kostenlos starten
            </Link>
          </div>

          <div className="p-card featured reveal">
            <div className="p-popular">Empfohlen</div>
            <div className="p-tier">Pro</div>
            <div className="p-price">12 €</div>
            <div className="p-period">pro Monat · jährlich</div>
            <div className="p-desc">Für aktive Organisationen, die alles brauchen.</div>
            <div className="p-divider" />
            <div className="p-features">
              <div className="p-feature">
                <svg className="p-check p-check-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Bis zu 200 Mitglieder
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Alle Features
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Finanzen &amp; CSV-Export
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Engagement Score
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Prioritäts-Support
              </div>
            </div>
            <Link href="/create-organisation" className="btn btn-white btn-lg" style={{ width: "100%", justifyContent: "center" }}>
              Jetzt starten <span className="arrow-icon">→</span>
            </Link>
          </div>

          <div className="p-card reveal">
            <div className="p-tier">Enterprise</div>
            <div className="p-price" style={{ fontSize: 34, paddingTop: 7 }}>
              Auf Anfrage
            </div>
            <div className="p-period">individuelles Angebot</div>
            <div className="p-desc">Für Dachverbände, Schulen und große Organisationen.</div>
            <div className="p-divider" />
            <div className="p-features">
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Unbegrenzte Mitglieder
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Mehrere Organisationen
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Custom Domain
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                SLA &amp; dedizierter Support
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                On-Premise möglich
              </div>
            </div>
            <a href="mailto:hello@orgflow.de" className="btn btn-outline" style={{ width: "100%", justifyContent: "center" }}>
              Kontakt aufnehmen
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

