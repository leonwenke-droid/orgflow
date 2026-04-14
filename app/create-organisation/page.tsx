import { Suspense } from "react";
import CreateOrganisationClient from "./CreateOrganisationClient";

export const dynamic = "force-dynamic";

/** Gleicher Ablauf wie mit bestehender Session: Wizard sofort, Anmeldung erst beim finalen API-Call (siehe Client). */
export default function CreateOrganisationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-secondary py-12 text-center text-sm text-text-secondary">Loading…</div>
      }
    >
      <CreateOrganisationClient />
    </Suspense>
  );
}
