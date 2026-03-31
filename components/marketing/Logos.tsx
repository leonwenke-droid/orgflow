export function Logos() {
  return (
    <section className="logos">
      <div className="container">
        <div className="logos-inner">
          <span className="logos-label">Genutzt von 50+ Organisationen:</span>
          <div className="logos-list">
            <div className="org-pill">
              <div className="org-icon" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>
                TG
              </div>
              TGG Leer
            </div>
            <div className="org-pill">
              <div className="org-icon" style={{ background: "var(--green-light)", color: "var(--green)" }}>
                SV
              </div>
              SV Westfalia
            </div>
            <div className="org-pill">
              <div className="org-icon" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>
                JF
              </div>
              Jugendfeuerwehr
            </div>
            <div className="org-pill">
              <div className="org-icon" style={{ background: "var(--red-light)", color: "var(--red)" }}>
                RK
              </div>
              Rotes Kreuz OV
            </div>
            <div className="org-pill">
              <div className="org-icon" style={{ background: "var(--surface)", color: "var(--ink-2)" }}>
                FS
              </div>
              Fachschaft Info
            </div>
            <div className="org-pill">
              <div className="org-icon" style={{ background: "var(--surface)", color: "var(--ink-3)" }}>
                +
              </div>
              &amp; viele mehr
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

