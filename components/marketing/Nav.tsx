"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrgFlowLogoMark } from "../brand/OrgFlowLogoMark";

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
            <div className="logo-mark text-white" aria-hidden>
              <OrgFlowLogoMark className="h-[14px] w-[14px]" />
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

