import { t } from "../../lib/i18n";
import type { Locale } from "../../lib/i18n";

export default function TermsContent({ locale }: { locale: Locale }) {
  const isDe = locale === "de";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary">
        {t("legal.terms_title", locale)}
      </h1>
      <div className="space-y-3 text-sm text-text-secondary dark:text-text-secondary">
        <p className="text-xs text-text-secondary dark:text-text-muted">
          {isDe ? "Stand: 18.03.2026" : "Last updated: 2026-03-18"}
        </p>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">
            {isDe ? "1. Anbieter" : "1. Provider"}
          </h2>
          <div className="rounded-lg border border-border-subtle bg-bg-primary p-4 dark:border-border-default bg-card">
            <p className="font-semibold">LYNIQ Media</p>
            <p>{isDe ? "Inhaber" : "Owner"}: Leon Wenke</p>
            <p>Alte Poststraße 17a, 26835 Holtland, {isDe ? "Deutschland" : "Germany"}</p>
            <p>USt-ID: DE455122753</p>
            <p>
              E-Mail:{" "}
              <a className="underline" href="mailto:info@lyniqmedia.com">
                info@lyniqmedia.com
              </a>
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">
            {isDe ? "2. Geltungsbereich" : "2. Scope"}
          </h2>
          <p>
            {isDe
              ? "Diese Nutzungsbedingungen regeln die Nutzung der SaaS-Plattform „OrgFlow“ durch Organisationen und deren eingeladenen Mitglieder."
              : "These terms govern the use of the SaaS platform \u201COrgFlow\u201D by organisations and their invited members."}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">
            {isDe ? "3. Registrierung & Einladungen" : "3. Accounts & invitations"}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              {isDe
                ? "OrgFlow ist invite-only: Konten werden durch Admins einer Organisation angelegt oder importiert und per persönlichem Link aktiviert."
                : "OrgFlow is invite-only: accounts are created/imported by an organisation admin and activated via a personal link."}
            </li>
            <li>
              {isDe
                ? "Admins verwalten Mitglieder und Rollen (z. B. Admin/Member) innerhalb ihrer Organisation."
                : "Admins manage members and roles (e.g., admin/member) within their organisation."}
            </li>
            <li>
              {isDe
                ? "Zugangsdaten sind vertraulich zu behandeln; die Organisation ist verantwortlich für die Vergabe und den Entzug von Zugriffsrechten."
                : "Credentials must be kept confidential; the organisation is responsible for granting and revoking access."}
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">
            {isDe ? "4. Leistungsbeschreibung" : "4. Service description"}
          </h2>
          <p>
            {isDe
              ? "OrgFlow unterstützt die Organisation von Teams, Aufgaben (Tasks), Schichten (Shifts), Ressourcen und Finanzen. Funktionsumfang kann je Organisation variieren."
              : "OrgFlow helps organise teams, tasks, shifts, resources and finances. Features may vary per organisation."}
          </p>
          <p className="text-xs text-text-secondary dark:text-text-muted">
            {isDe
              ? "Hinweis: OrgFlow ist ein Organisationswerkzeug und ersetzt keine rechtliche, steuerliche oder arbeitsrechtliche Beratung."
              : "Note: OrgFlow is an organisational tool and does not replace legal, tax or employment advice."}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">
            {isDe ? "5. Pflichten der Nutzer / Acceptable Use" : "5. User obligations / acceptable use"}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              {isDe
                ? "Keine rechtswidrigen Inhalte, keine Verletzung von Rechten Dritter, keine missbräuchlichen Zugriffe/Angriffe."
                : "No unlawful content, no infringement of third-party rights, no abusive access/attacks."}
            </li>
            <li>
              {isDe
                ? "Organisationen sind verantwortlich für die von ihnen eingegebenen Daten sowie die datenschutzrechtliche Einbindung ihrer Mitglieder."
                : "Organisations are responsible for the data they enter and for complying with data protection rules for their members."}
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">
            {isDe ? "6. Verfügbarkeit & Änderungen" : "6. Availability & changes"}
          </h2>
          <p>
            {isDe
              ? "Wir bemühen uns um eine hohe Verfügbarkeit, können jedoch keine ununterbrochene Erreichbarkeit garantieren. Wir dürfen OrgFlow weiterentwickeln und Funktionen anpassen, sofern dies für Nutzer zumutbar ist."
              : "We aim for high availability but cannot guarantee uninterrupted access. We may evolve OrgFlow and adjust features, as long as this is reasonable for users."}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">
            {isDe ? "7. Haftung" : "7. Liability"}
          </h2>
          <p>
            {isDe
              ? "Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit. Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) und begrenzt auf den typischerweise vorhersehbaren Schaden."
              : "We are liable without limitation for intent and gross negligence and for injury to life, body or health. For simple negligence, we are liable only for breach of essential contractual duties and limited to the typically foreseeable damage."}
          </p>
          <p className="text-xs text-text-secondary dark:text-text-muted">
            {isDe
              ? "Soweit gesetzlich zulässig, ist eine Haftung für Datenverluste ausgeschlossen, sofern diese durch angemessene Datensicherungsmaßnahmen vermeidbar gewesen wären."
              : "To the extent permitted by law, liability for data loss is excluded if avoidable through reasonable backups."}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">
            {isDe ? "8. Laufzeit & Kündigung" : "8. Term & termination"}
          </h2>
          <p>
            {isDe
              ? "Die Nutzung erfolgt für die Dauer der jeweiligen Vertragsbeziehung. Admins können Mitglieder deaktivieren und den Zugang entziehen. Wir können den Zugang bei Verstößen oder Sicherheitsrisiken sperren."
              : "Use continues for the duration of the contractual relationship. Admins can deactivate members and revoke access. We may suspend access for violations or security risks."}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">
            {isDe ? "9. Datenschutz" : "9. Data protection"}
          </h2>
          <p>
            {isDe
              ? "Informationen zur Verarbeitung personenbezogener Daten finden Sie in der Datenschutzerklärung."
              : "Information about personal data processing is provided in the privacy policy."}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">
            {isDe ? "10. Schlussbestimmungen" : "10. Final provisions"}
          </h2>
          <p>
            {isDe
              ? "Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Gerichtsstand, soweit zulässig, ist Leer (Ostfriesland). Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Regelungen unberührt."
              : "German law applies, excluding the UN Convention on Contracts for the International Sale of Goods. The place of jurisdiction, where permissible, is Leer (East Frisia), Germany. If any provision is invalid, the remaining provisions remain effective."}
          </p>
        </section>
      </div>
    </div>
  );
}
