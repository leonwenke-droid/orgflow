import Link from "next/link";

export function CTA() {
  return (
    <section className="cta-section">
      <div className="container">
        <h2>
          Bereit, <em>loszulegen?</em>
        </h2>
        <p className="cta-sub">
          Deine Organisation verdient mehr als eine Excel-Tabelle. Starte in zwei Minuten — kostenlos.
        </p>
        <div className="cta-actions">
          <Link href="/create-organisation" className="btn btn-blue btn-lg">
            Kostenlos registrieren <span className="arrow-icon">→</span>
          </Link>
          <a
            href="mailto:hello@orgflow.de"
            className="btn btn-lg"
            style={{ color: "rgba(255,255,255,.65)", border: "1px solid rgba(255,255,255,.18)" }}
          >
            Demo anfragen
          </a>
        </div>
        <p className="cta-note">Keine Kreditkarte · Keine Kündigungsfrist · Gehostet in Deutschland</p>
      </div>
    </section>
  );
}

