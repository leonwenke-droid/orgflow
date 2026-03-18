import { cookies } from "next/headers";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../lib/i18n";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const isDe = locale === "de";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {t("legal.privacy_title", locale)}
      </h1>
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isDe ? "Stand: 18.03.2026" : "Last updated: 2026-03-18"}
        </p>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {isDe ? "1. Verantwortlicher" : "1. Controller"}
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-card-dark">
            <p className="font-semibold">LYNIQ Media</p>
            <p>{isDe ? "Inhaber" : "Owner"}: Leon Wenke</p>
            <p>Alte Poststraße 17a, 26835 Holtland, {isDe ? "Deutschland" : "Germany"}</p>
            <p>
              E-Mail:{" "}
              <a className="underline" href="mailto:info@lyniqmedia.com">
                info@lyniqmedia.com
              </a>
            </p>
            <p>
              Website:{" "}
              <a className="underline" href="https://www.lyniqmedia.com" target="_blank" rel="noreferrer">
                www.lyniqmedia.com
              </a>
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {isDe ? "2. Welche Daten verarbeitet OrgFlow?" : "2. What data does OrgFlow process?"}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            <li>
              {isDe
                ? "Account- und Authentifizierungsdaten (E-Mail, Login-Sessions)."
                : "Account and authentication data (email, login sessions)."}
            </li>
            <li>
              {isDe
                ? "Profildaten innerhalb einer Organisation (Name, optional Telefon, Rolle, Status)."
                : "Profile data within an organisation (name, optional phone, role, status)."}
            </li>
            <li>
              {isDe
                ? "Organisationsdaten, die von Admins gepflegt werden (Teams, Aufgaben, Schichten, Ressourcen, Finanz-Einträge)."
                : "Organisation data managed by admins (teams, tasks, shifts, resources, finance entries)."}
            </li>
            <li>
              {isDe
                ? "Technische Protokolldaten (z. B. IP-Adresse/Logdaten), soweit erforderlich für Stabilität und Sicherheit."
                : "Technical log data (e.g., IP/logs) as required for stability and security."}
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {isDe ? "3. Zwecke und Rechtsgrundlagen" : "3. Purposes and legal bases"}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            <li>
              {isDe
                ? "Bereitstellung der Plattform (Art. 6 Abs. 1 lit. b DSGVO – Vertrag/Vorvertrag)."
                : "Providing the platform (Art. 6(1)(b) GDPR – contract/pre-contract)."}
            </li>
            <li>
              {isDe
                ? "Sicherheit, Missbrauchsprävention, Fehleranalyse (Art. 6 Abs. 1 lit. f DSGVO – berechtigtes Interesse)."
                : "Security, abuse prevention, debugging (Art. 6(1)(f) GDPR – legitimate interest)."}
            </li>
            <li>
              {isDe
                ? "Kommunikation und Support (Art. 6 Abs. 1 lit. b/f DSGVO)."
                : "Communication and support (Art. 6(1)(b)/(f) GDPR)."}
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {isDe ? "4. Cookies" : "4. Cookies"}
          </h2>
          <p>
            {isDe
              ? "OrgFlow verwendet technisch notwendige Cookies (z. B. für Anmeldung/Sitzung und Sicherheit). Es werden keine Tracking-Cookies eingesetzt."
              : "OrgFlow uses essential cookies (e.g., for sign-in/session and security). No tracking cookies are used."}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {isDe ? "5. Empfänger / Auftragsverarbeiter" : "5. Recipients / processors"}
          </h2>
          <p>
            {isDe
              ? "Für den Betrieb können Dienstleister eingesetzt werden (z. B. Hosting, E-Mail, Datenbank/Auth). Wir schließen bei Bedarf Auftragsverarbeitungsverträge nach Art. 28 DSGVO."
              : "We may use service providers to operate OrgFlow (e.g., hosting, email, database/auth). We enter data processing agreements under Art. 28 GDPR where required."}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>{isDe ? "Supabase (Auth & Datenbank)" : "Supabase (auth & database)"}</li>
            <li>{isDe ? "Hosting/Deployment (z. B. Vercel)" : "Hosting/deployment (e.g., Vercel)"}</li>
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isDe
              ? "Hinweis: Je nach Konfiguration kann eine Verarbeitung außerhalb der EU/des EWR stattfinden. In diesem Fall werden geeignete Garantien (z. B. Standardvertragsklauseln) genutzt."
              : "Note: Depending on configuration, processing may occur outside the EU/EEA. In such cases, appropriate safeguards (e.g., SCCs) are used."}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {isDe ? "6. Speicherdauer" : "6. Retention"}
          </h2>
          <p>
            {isDe
              ? "Daten werden nur so lange gespeichert, wie es für die jeweiligen Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen."
              : "Data is stored only as long as necessary for the purposes described or as required by law."}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {isDe ? "7. Ihre Rechte" : "7. Your rights"}
          </h2>
          <p>
            {isDe
              ? "Sie haben Rechte auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) nach DSGVO."
              : "You have rights of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction (Art. 18), portability (Art. 20) and objection (Art. 21) under the GDPR."}
          </p>
          <p>
            {isDe ? "Kontakt für Anfragen:" : "Contact for requests:"}{" "}
            <a className="underline" href="mailto:info@lyniqmedia.com">
              info@lyniqmedia.com
            </a>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {isDe ? "8. Änderungen" : "8. Changes"}
          </h2>
          <p>
            {isDe
              ? "Wir behalten uns vor, diese Datenschutzerklärung anzupassen. Die jeweils aktuelle Version ist in OrgFlow abrufbar."
              : "We may update this privacy policy. The current version is available within OrgFlow."}
          </p>
        </section>
      </div>
    </div>
  );
}
