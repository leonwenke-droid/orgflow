export function HowItWorks() {
  return (
    <section className="how" id="how">
      <div className="container">
        <div className="how-head">
          <div className="section-label">So einfach geht&apos;s</div>
          <h2>In drei Schritten loslegen.</h2>
          <p>Keine lange Einrichtung. Keine IT-Abteilung nötig. Registrieren und starten.</p>
        </div>
        <div className="steps">
          <div className="step reveal">
            <div className="step-num">1</div>
            <div className="step-title">Organisation anlegen</div>
            <div className="step-desc">
              Name, Slug, fertig — in weniger als zwei Minuten bist du Admin deiner Organisation.
            </div>
          </div>
          <div className="step reveal">
            <div className="step-num">2</div>
            <div className="step-title">Mitglieder einladen</div>
            <div className="step-desc">
              Per E-Mail oder Excel-Import. Jedes Mitglied bekommt sofort Zugang zum eigenen Bereich.
            </div>
          </div>
          <div className="step reveal">
            <div className="step-num">3</div>
            <div className="step-title">Zusammen organisieren</div>
            <div className="step-desc">
              Aufgaben verteilen, Schichten planen, Finanzen tracken — alles läuft jetzt an einem Ort.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

