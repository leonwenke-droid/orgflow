import CreateOrganisationClient from "./CreateOrganisationClient";

export const dynamic = "force-dynamic";

/** Gleicher Ablauf wie mit bestehender Session: Wizard sofort, Anmeldung erst beim finalen API-Call (siehe Client). */
export default function CreateOrganisationPage() {
  return <CreateOrganisationClient />;
}
