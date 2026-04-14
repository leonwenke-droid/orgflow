export function Testimonials() {
  return (
    <section className="testimonials">
      <div className="container">
        <div className="t-head">
          <div className="section-label">Stimmen aus der Praxis</div>
          <h2>Was unsere Nutzer sagen.</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            Zwei der Karten sind bewusst als Platzhalter gekennzeichnet — keine echten Kundenstimmen, bis wir
            ausdrückliche Zitate haben.
          </p>
        </div>
        <div className="t-grid">
          <div className="t-card reveal">
            <div className="t-stars">
              <span className="t-star">★</span><span className="t-star">★</span><span className="t-star">★</span><span className="t-star">★</span><span className="t-star">★</span>
            </div>
            <div className="t-quote">
              &quot;Wir haben unsere komplette Abifestigkeiten damit organisiert — 73 Leute, über 70 Schichten, 8 Teams. Ohne OrgFlow wäre das nicht möglich gewesen.&quot;
            </div>
            <div className="t-author">
              <div className="t-avatar" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>LW</div>
              <div>
                <div className="t-name">Leon Wenke</div>
                <div className="t-role">Jahrgangssprecher, Abi 2026 - TGG Leer</div>
              </div>
            </div>
          </div>

          <div className="t-card reveal">
            <div className="t-stars">
              <span className="t-star">★</span><span className="t-star">★</span><span className="t-star">★</span><span className="t-star">★</span><span className="t-star">★</span>
            </div>
            <div className="t-quote">
              &quot;Beispiel-Zitat (Platzhalter): So könnte ein Verein beschreiben, wie Aufgaben und Schichten mit OrgFlow
              zusammenlaufen — ohne dass wir eine reale Person nennen.&quot;
            </div>
            <div className="t-author">
              <div className="t-avatar" style={{ background: "var(--green-light)", color: "var(--green)" }}>?</div>
              <div>
                <div className="t-name">Beta-Nutzer (Platzhalter)</div>
                <div className="t-role">Ehrenamt, Deutschland</div>
              </div>
            </div>
          </div>

          <div className="t-card reveal">
            <div className="t-stars">
              <span className="t-star">★</span><span className="t-star">★</span><span className="t-star">★</span><span className="t-star">★</span><span className="t-star">★</span>
            </div>
            <div className="t-quote">
              &quot;Beispiel-Zitat (Platzhalter): Transparenz bei Finanzen und klare Zuständigkeiten — rein illustrativ, bis
              wir echte Referenzen veröffentlichen.&quot;
            </div>
            <div className="t-author">
              <div className="t-avatar" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>?</div>
              <div>
                <div className="t-name">Organisation (Platzhalter)</div>
                <div className="t-role">Verein / Schule / NGO</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

