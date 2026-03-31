export function Testimonials() {
  return (
    <section className="testimonials">
      <div className="container">
        <div className="t-head">
          <div className="section-label">Stimmen aus der Praxis</div>
          <h2>Was unsere Nutzer sagen.</h2>
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
              &quot;Endlich weiß jeder im Verein, was zu tun ist. Der Engagement Score hat die Motivation komplett verändert — alle wollen Punkte sammeln.&quot;
            </div>
            <div className="t-author">
              <div className="t-avatar" style={{ background: "var(--green-light)", color: "var(--green)" }}>MH</div>
              <div>
                <div className="t-name">Maria Hoffmann</div>
                <div className="t-role">Vorstand, SV Westfalia 1923</div>
              </div>
            </div>
          </div>

          <div className="t-card reveal">
            <div className="t-stars">
              <span className="t-star">★</span><span className="t-star">★</span><span className="t-star">★</span><span className="t-star">★</span><span className="t-star">★</span>
            </div>
            <div className="t-quote">
              &quot;Die Finanzen-Seite hat unserer Kassenprüfung komplett gerettet. Transparente Buchungen, CSV-Export — unser Kassenprüfer war begeistert.&quot;
            </div>
            <div className="t-author">
              <div className="t-avatar" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>TK</div>
              <div>
                <div className="t-name">Tobias Klein</div>
                <div className="t-role">Schatzmeister, Jugendfeuerwehr</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

