import Link from "next/link";

export function Problem() {
  return (
    <section className="problem">
      <div className="container">
        <div className="problem-grid">
          <div>
            <div className="section-label">Das Problem</div>
            <h2>
              Organisationen verlieren sich in <em>endlosen Tabellen.</em>
            </h2>
            <p className="problem-text">
              WhatsApp-Gruppen, Excel-Sheets, Google Docs — die meisten Organisationen jonglieren mit fünf Tools
              gleichzeitig. Das kostet Zeit, schafft Chaos und frustriert Freiwillige.
            </p>
            <a href="#features" className="btn btn-dark">
              Wie OrgFlow das löst <span className="arrow-icon">→</span>
            </a>
          </div>
          <div className="pain-list">
            <div className="pain-item reveal">
              <div className="pain-icon">📋</div>
              <div>
                <div className="pain-title">Aufgaben gehen unter</div>
                <div className="pain-desc">
                  Wer macht was bis wann? In WhatsApp-Nachrichten findet das niemand mehr.
                </div>
              </div>
            </div>
            <div className="pain-item reveal">
              <div className="pain-icon">🗓️</div>
              <div>
                <div className="pain-title">Schichtplanung per Hand</div>
                <div className="pain-desc">
                  Einzeln durchfragen, wer wann kann — ein zeitraubender Kreislauf für jede Veranstaltung.
                </div>
              </div>
            </div>
            <div className="pain-item reveal">
              <div className="pain-icon">💸</div>
              <div>
                <div className="pain-title">Finanzen unklar</div>
                <div className="pain-desc">
                  Kassenstand unbekannt, Belege fehlen, Revisionen unmöglich — klassisch.
                </div>
              </div>
            </div>
            <div className="pain-item reveal">
              <div className="pain-icon">⚡</div>
              <div>
                <div className="pain-title">Engagement ungleich verteilt</div>
                <div className="pain-desc">
                  Dieselben machen alles. Der Rest weiß nicht mal, was es zu tun gibt.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

