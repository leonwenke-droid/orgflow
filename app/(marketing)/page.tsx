import type { Metadata } from "next";
import { Nav } from "../../components/marketing/Nav";
import { Hero } from "../../components/marketing/Hero";
import { Logos } from "../../components/marketing/Logos";
import { Problem } from "../../components/marketing/Problem";
import { Features } from "../../components/marketing/Features";
import { HowItWorks } from "../../components/marketing/HowItWorks";
import { Testimonials } from "../../components/marketing/Testimonials";
import { Pricing } from "../../components/marketing/Pricing";
import { CTA } from "../../components/marketing/CTA";
import { Footer } from "../../components/marketing/Footer";
import { RevealInit } from "../../components/marketing/RevealInit";

export const metadata: Metadata = {
  title: "OrgFlow – Organisation, die funktioniert.",
  description:
    "Aufgaben, Schichten, Mitglieder und Finanzen in einem Tool. Für Vereine, Schulen, NGOs und Unternehmen.",
  openGraph: {
    title: "OrgFlow",
    description: "Organisation, die wirklich funktioniert.",
    url: "https://orgflow.de",
    siteName: "OrgFlow",
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OrgFlow – Organisation, die funktioniert.",
  },
  robots: { index: true, follow: true },
};

export default function MarketingPage() {
  return (
    <>
      <Nav />
      <Hero />
      <Logos />
      <Problem />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
      <RevealInit />
    </>
  );
}

