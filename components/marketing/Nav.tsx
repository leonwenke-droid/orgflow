"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    handler();
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav style={scrolled ? { borderBottomColor: "var(--border-mid)" } : undefined}>
      <div className="container">
        <div className="nav-inner">
          <Link href="/" className="logo" aria-label="OrgFlow">
            <div className="logo-mark" aria-hidden>
              <svg viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1.5" fill="white" />
                <rect x="8" y="1" width="5" height="5" rx="1.5" fill="white" opacity=".5" />
                <rect x="1" y="8" width="5" height="5" rx="1.5" fill="white" opacity=".5" />
                <rect x="8" y="8" width="5" height="5" rx="1.5" fill="white" opacity=".3" />
              </svg>
            </div>
            OrgFlow
          </Link>

          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how">So funktioniert&apos;s</a>
            <a href="#pricing">Preise</a>
          </div>

          <div className="nav-cta">
            <Link href="/login?redirectTo=/dashboard" className="nav-login">
              Anmelden
            </Link>
            <Link href="/create-organisation" className="btn btn-dark btn-nav">
              Kostenlos starten
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

