export function Features() {
  return (
    <section className="features" id="features">
      <div className="container">
        <div className="features-head">
          <div className="section-label">Features</div>
          <h2>Alles, was eine Organisation braucht.</h2>
          <p>Sechs Kernbereiche, durchdacht gebaut — kein Overhead, keine Ablenkung.</p>
        </div>
        <div className="features-grid">
          <div className="feature-card reveal">
            <div className="feature-icon-wrap">
              <svg viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.5">
                <rect x="2" y="2" width="6" height="6" rx="1.5" />
                <rect x="12" y="2" width="6" height="6" rx="1.5" />
                <rect x="2" y="12" width="6" height="6" rx="1.5" />
                <rect x="12" y="12" width="6" height="6" rx="1.5" />
              </svg>
            </div>
            <div className="feature-title">Aufgaben &amp; Kanban</div>
            <div className="feature-desc">
              Erstelle Aufgaben, weise sie Teams zu und verfolge den Fortschritt auf einem übersichtlichen Board.
              Mitglieder übernehmen Aufgaben selbst.
            </div>
            <span className="feature-tag">Kanban-Board</span>
          </div>

          <div className="feature-card reveal">
            <div className="feature-icon-wrap">
              <svg viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.5">
                <circle cx="10" cy="10" r="8" />
                <polyline points="10,5 10,10 13,13" />
              </svg>
            </div>
            <div className="feature-title">Schichtplanung</div>
            <div className="feature-desc">
              Schichten anlegen, Mitglieder eintragen oder automatisch zuteilen. Kalender-View, Slot-Verwaltung und
              Echtzeit-Auslastung.
            </div>
            <span className="feature-tag">Auto-Zuteilung</span>
          </div>

          <div className="feature-card reveal">
            <div className="feature-icon-wrap">
              <svg viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.5">
                <circle cx="7" cy="7" r="3" />
                <path d="M2 17c0-3 2.5-5 5-5s5 2 5 5" />
                <circle cx="15" cy="7" r="2.5" />
                <path d="M15 12c2 0 3.5 1 3.5 4" />
              </svg>
            </div>
            <div className="feature-title">Mitglieder &amp; Teams</div>
            <div className="feature-desc">
              Strukturiere deine Organisation in Teams. Rolle-basierte Zugriffsrechte, Excel-Import und Einladungen per
              E-Mail.
            </div>
            <span className="feature-tag">Rollenbasiert</span>
          </div>

          <div className="feature-card reveal">
            <div className="feature-icon-wrap">
              <svg viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.5">
                <rect x="2" y="3" width="16" height="14" rx="2" />
                <line x1="2" y1="7" x2="18" y2="7" />
                <line x1="6" y1="1" x2="6" y2="5" />
                <line x1="14" y1="1" x2="14" y2="5" />
              </svg>
            </div>
            <div className="feature-title">Veranstaltungen</div>
            <div className="feature-desc">
              Plane Events mit verknüpften Schichten und Aufgaben. Alles, was zur Veranstaltung gehört, an einem Ort.
            </div>
            <span className="feature-tag feature-tag-g">Neu</span>
          </div>

          <div className="feature-card reveal">
            <div className="feature-icon-wrap">
              <svg viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.5">
                <rect x="2" y="5" width="16" height="12" rx="2" />
                <line x1="2" y1="9" x2="18" y2="9" />
                <path d="M6 5V3.5a4 4 0 0 1 8 0V5" />
              </svg>
            </div>
            <div className="feature-title">Finanzen &amp; Kasse</div>
            <div className="feature-desc">
              Einnahmen und Ausgaben verbuchen, Excel-Import für den Kassenstand, CSV-Export. Transparenz für alle
              Verantwortlichen.
            </div>
            <span className="feature-tag">DSGVO-konform</span>
          </div>

          <div className="feature-card reveal">
            <div className="feature-icon-wrap">
              <svg viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.5">
                <polygon points="10,2 12.3,7.8 18.5,8.2 14,12.1 15.5,18.5 10,15.5 4.5,18.5 6,12.1 1.5,8.2 7.7,7.8" />
              </svg>
            </div>
            <div className="feature-title">Engagement Score</div>
            <div className="feature-desc">
              Punkte für Schichten, Aufgaben und Ressourcen. Eine faire Rangliste motiviert alle — und macht Beitrag
              sichtbar.
            </div>
            <span className="feature-tag feature-tag-g">Motivation</span>
          </div>
        </div>
      </div>
    </section>
  );
}

