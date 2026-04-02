"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrgFlowLogoLockup } from "../brand/OrgFlowLogoLockup";

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
          <OrgFlowLogoLockup href="/" size="sm" className="logo" />

          <div className="nav-links">
            <Link href="/features">Features</Link>
            <Link href="/#how">So funktioniert&apos;s</Link>
            <Link href="/preise">Preise</Link>
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

