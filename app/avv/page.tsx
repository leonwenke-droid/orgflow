import { getRequestLocale } from "../../lib/localeServer";

export const dynamic = "force-dynamic";

export default async function AvvPage() {
  const locale = await getRequestLocale();
  const isDe = locale === "de";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {isDe ? "Auftragsverarbeitungsvertrag (AVV)" : "Data Processing Agreement (DPA)"}
      </h1>
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isDe ? "Stand: 18.03.2026" : "Last updated: 2026-03-18"}
        </p>

        <p>
          {isDe
            ? "Für OrgFlow stellen wir auf Anfrage einen AVV nach Art. 28 DSGVO bereit."
            : "For OrgFlow, we provide a DPA under Art. 28 GDPR upon request."}
        </p>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-card-dark">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {isDe ? "AVV anfordern" : "Request a DPA"}
          </p>
          <p className="mt-1 text-sm">
            {isDe
              ? "Sende uns bitte eine E-Mail mit Organisationsname und Rechnungsadresse."
              : "Email us your organisation name and billing address."}
          </p>
          <p className="mt-2">
            <a className="underline" href="mailto:info@lyniqmedia.com?subject=OrgFlow%20AVV%20Anfrage">
              info@lyniqmedia.com
            </a>
          </p>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isDe
            ? "Hinweis: Diese Seite ist eine Einstiegsmöglichkeit und ersetzt keine Rechtsberatung."
            : "Note: This page is an entry point and does not constitute legal advice."}
        </p>
      </div>
    </div>
  );
}

