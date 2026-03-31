import Link from "next/link";

export function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div>
            <div className="hero-badge anim-1">
              <span className="badge">
                <span className="badge-dot" />
                Neu: Schichtplanung mit Kalender-View
              </span>
            </div>
            <h1 className="anim-2">
              Organisation,
              <br />
              die <em>wirklich</em>
              <br />
              funktioniert.
            </h1>
            <p className="hero-sub anim-3">
              Aufgaben, Schichten, Mitglieder und Finanzen — alles an einem Ort. Für Vereine,
              Schulen, NGOs und jede Organisation, die mehr als eine Tabelle verdient.
            </p>
            <div className="hero-actions anim-4">
              <Link href="/create-organisation" className="btn btn-blue btn-lg">
                Kostenlos loslegen <span className="arrow-icon">→</span>
              </Link>
              <a
                href="#features"
                className="btn btn-lg"
                style={{
                  color: "rgba(255,255,255,.75)",
                  border: "1px solid rgba(255,255,255,.18)",
                }}
              >
                Features entdecken
              </a>
            </div>
            <p className="hero-note anim-4">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="3,8 7,12 13,4" />
              </svg>
              Keine Kreditkarte · Sofort einsatzbereit · DSGVO-konform
            </p>
          </div>

          <div className="hero-visual anim-5">
            <div className="hero-mockup">
              <div className="mockup-bar">
                <div className="mockup-dot" style={{ background: "#ff5f57" }} />
                <div className="mockup-dot" style={{ background: "#febc2e" }} />
                <div className="mockup-dot" style={{ background: "#28c840" }} />
              </div>
              <div className="mockup-body">
                <div className="m-header">
                  <div>
                    <div className="m-title">Guten Abend, Leon</div>
                    <div className="m-sub">TGG Leer · Dashboard</div>
                  </div>
                  <div className="m-badge">Score #1</div>
                </div>
                <div className="m-stats">
                  <div className="m-stat">
                    <div className="m-stat-v">74</div>
                    <div className="m-stat-l">Mitglieder</div>
                  </div>
                  <div className="m-stat">
                    <div className="m-stat-v" style={{ color: "#5DCAA5" }}>
                      4
                    </div>
                    <div className="m-stat-l">Schichten frei</div>
                  </div>
                  <div className="m-stat">
                    <div className="m-stat-v">1.292 €</div>
                    <div className="m-stat-l">Kontostand</div>
                  </div>
                </div>
                <div>
                  <div className="m-list-item">
                    <div className="m-dot" style={{ background: "#3B6D11" }} />
                    <div className="m-text">Helferschicht Aufbau</div>
                    <div className="m-meta">09:00–11:00</div>
                    <div className="m-chip">4 frei</div>
                  </div>
                  <div className="m-list-item">
                    <div className="m-dot" style={{ background: "#3B6D11" }} />
                    <div className="m-text">Einlasskontrolle</div>
                    <div className="m-meta">11:00–13:00</div>
                    <div className="m-chip" style={{ background: "rgba(24,95,165,.3)", color: "#85B7EB" }}>
                      Eingetr.
                    </div>
                  </div>
                  <div className="m-list-item">
                    <div className="m-dot" style={{ background: "#854F0B" }} />
                    <div className="m-text">Programmheft Layout</div>
                    <div className="m-meta">Fällig 27.3.</div>
                    <div className="m-chip m-chip-g">In Arbeit</div>
                  </div>
                  <div className="m-list-item">
                    <div className="m-dot" style={{ background: "#A32D2D" }} />
                    <div className="m-text">Social Media Post</div>
                    <div className="m-meta">Überfällig</div>
                    <div className="m-chip" style={{ background: "rgba(163,45,45,.3)", color: "#F09595" }}>
                      Dringend
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="floating-card fc-right">
              <div className="fc-label">Engagement Score</div>
              <div className="fc-value" style={{ color: "var(--blue)" }}>
                8 Pkt.
              </div>
              <div className="fc-sub">Platz #1 von 74</div>
            </div>

            <div className="floating-card fc-left fc-dark">
              <div className="fc-label">Top Mitglieder</div>
              <div className="fc-row">
                <div className="fc-avatar" style={{ background: "#185FA5", color: "#fff" }}>
                  LW
                </div>
                <span className="fc-name" style={{ color: "rgba(255,255,255,.8)" }}>
                  Leon W.
                </span>
                <span className="fc-pts" style={{ color: "#5DCAA5" }}>
                  24
                </span>
              </div>
              <div className="fc-row">
                <div className="fc-avatar" style={{ background: "#3B6D11", color: "#fff" }}>
                  FM
                </div>
                <span className="fc-name" style={{ color: "rgba(255,255,255,.8)" }}>
                  Femke M.
                </span>
                <span className="fc-pts" style={{ color: "rgba(255,255,255,.45)" }}>
                  18
                </span>
              </div>
              <div className="fc-row">
                <div className="fc-avatar" style={{ background: "#854F0B", color: "#fff" }}>
                  CK
                </div>
                <span className="fc-name" style={{ color: "rgba(255,255,255,.8)" }}>
                  Celina K.
                </span>
                <span className="fc-pts" style={{ color: "rgba(255,255,255,.45)" }}>
                  12
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

