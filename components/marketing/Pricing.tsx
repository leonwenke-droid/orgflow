import Link from "next/link";
import PaidPlanCheckoutButton from "./PaidPlanCheckoutButton";

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
                5 Personen in einem Team
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
                Ressourcen
              </div>
              <div className="p-feature" style={{ opacity: 0.45 }}>
                <svg className="p-check p-check-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="4" y1="8" x2="12" y2="8" />
                </svg>
                Engagement Score
              </div>
              <div className="p-feature" style={{ opacity: 0.45 }}>
                <svg className="p-check p-check-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="4" y1="8" x2="12" y2="8" />
                </svg>
                Veranstaltungen
              </div>
            </div>
            <Link href="/create-organisation" className="btn btn-outline" style={{ width: "100%", justifyContent: "center" }}>
              Kostenlos starten
            </Link>
          </div>

          <div className="p-card featured reveal">
            <div className="p-popular">Empfohlen</div>
            <div className="p-tier">Team</div>
            <div className="p-price">29 €</div>
            <div className="p-period">pro Monat · bis 49 Mitglieder</div>
            <div className="p-desc" style={{ marginTop: 12 }}>
              Für aktive Organisationen — bis 49 Mitglieder. Größer? Siehe Tarif rechts (49 €).
            </div>
            <div className="p-divider" />
            <div className="p-features">
              <div className="p-feature">
                <svg className="p-check p-check-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                2-wöchige kostenlose Testphase vor erster Abbuchung
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Bis zu 49 Mitglieder inklusive
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
            <PaidPlanCheckoutButton
              tier="base"
              className="btn btn-white btn-lg"
              style={{ width: "100%", justifyContent: "center" }}
            >
              Organisation anlegen <span className="arrow-icon">→</span>
            </PaidPlanCheckoutButton>
          </div>

          <div className="p-card reveal">
            <div className="p-tier">Pro</div>
            <div className="p-price">49 €</div>
            <div className="p-period">pro Monat · ab dem 50. Mitglied</div>
            <div className="p-desc">
              Derselbe Funktionsumfang wie Team — fester Preis für große Teams.
            </div>
            <div className="p-divider" />
            <div className="p-features">
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                2-wöchige kostenlose Testphase vor erster Abbuchung
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Unbegrenzt viele Mitglieder
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Alle Team-Features (Finanzen, Engagement, …)
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Buchung &amp; Upgrade direkt in der Organisation
              </div>
              <div className="p-feature">
                <svg className="p-check p-check-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Prioritäts-Support
              </div>
            </div>
            <PaidPlanCheckoutButton
              tier="scale"
              className="btn btn-outline"
              style={{ width: "100%", justifyContent: "center" }}
            >
              Organisation anlegen
            </PaidPlanCheckoutButton>
          </div>
        </div>
      </div>
    </section>
  );
}

