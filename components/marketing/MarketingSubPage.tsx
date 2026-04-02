import type { ReactNode } from "react";
import Link from "next/link";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { RevealInit } from "./RevealInit";

type Props = {
  title: string;
  lead?: string;
  eyebrow?: string;
  wide?: boolean;
  children: ReactNode;
};

export function MarketingSubPage({ title, lead, eyebrow, wide, children }: Props) {
  return (
    <>
      <Nav />
      <section className="subpage-hero">
        <div className="container">
          {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {lead ? <p className="subpage-lead">{lead}</p> : null}
        </div>
      </section>
      <section className={`subpage-body${wide ? " subpage-body--wide" : ""}`}>
        <div className="container">
          <div className="subpage-inner">
            <Link href="/" className="subpage-back">
              ← Zur Startseite
            </Link>
            {children}
          </div>
        </div>
      </section>
      <Footer />
      <RevealInit />
    </>
  );
}
