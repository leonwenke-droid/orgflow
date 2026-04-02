import type { Metadata } from "next";
import { Nav } from "../../../components/marketing/Nav";
import { Features } from "../../../components/marketing/Features";
import { Footer } from "../../../components/marketing/Footer";
import { RevealInit } from "../../../components/marketing/RevealInit";

export const metadata: Metadata = {
  title: "Features – OrgFlow",
  description:
    "Aufgaben, Schichtplanung, Mitglieder, Veranstaltungen, Finanzen und Engagement — alles für eure Organisation in einem Tool.",
  robots: { index: true, follow: true },
};

export default function FeaturesPage() {
  return (
    <>
      <Nav />
      <Features />
      <Footer />
      <RevealInit />
    </>
  );
}
