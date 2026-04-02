import type { Metadata } from "next";
import { Nav } from "../../../components/marketing/Nav";
import { Pricing } from "../../../components/marketing/Pricing";
import { Footer } from "../../../components/marketing/Footer";
import { RevealInit } from "../../../components/marketing/RevealInit";

export const metadata: Metadata = {
  title: "Preise – OrgFlow",
  description:
    "Starter kostenlos, Pro mit allen Features, Enterprise auf Anfrage. Transparente Preise für Vereine, Schulen und NGOs.",
  robots: { index: true, follow: true },
};

export default function PreisePage() {
  return (
    <>
      <Nav />
      <Pricing />
      <Footer />
      <RevealInit />
    </>
  );
}
