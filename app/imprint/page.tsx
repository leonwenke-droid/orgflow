import { getRequestLocale } from "../../lib/localeServer";
import { t } from "../../lib/i18n";

export const dynamic = "force-dynamic";

export default async function ImprintPage() {
  const locale = await getRequestLocale();
  const isDe = locale === "de";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {t("legal.imprint_title", locale)}
      </h1>
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isDe ? "Angaben gemäß § 5 TMG" : "Information pursuant to § 5 TMG (Germany)"}
        </p>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-card-dark">
          <p className="font-semibold">LYNIQ Media</p>
          <p>{isDe ? "Inhaber" : "Owner"}: Leon Wenke</p>
          <p>Alte Poststraße 17a</p>
          <p>26835 Holtland</p>
          <p>{isDe ? "Deutschland" : "Germany"}</p>
        </div>

        <div className="space-y-1">
          <p className="font-semibold">{isDe ? "Kontakt" : "Contact"}</p>
          <p>
            Website:{" "}
            <a className="underline" href="https://www.lyniqmedia.com" target="_blank" rel="noreferrer">
              www.lyniqmedia.com
            </a>
          </p>
          <p>
            E-Mail:{" "}
            <a className="underline" href="mailto:info@lyniqmedia.com">
              info@lyniqmedia.com
            </a>
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-semibold">{isDe ? "Umsatzsteuer-ID" : "VAT ID"}</p>
          <p>DE455122753</p>
        </div>

        <div className="space-y-1">
          <p className="font-semibold">{isDe ? "Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV" : "Content responsibility (§ 55 Abs. 2 RStV)"}</p>
          <p>Leon Wenke, Alte Poststraße 17a, 26835 Holtland, {isDe ? "Deutschland" : "Germany"}</p>
        </div>

        <div className="space-y-2">
          <p className="font-semibold">{isDe ? "Streitschlichtung" : "Dispute resolution"}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {isDe ? (
              <>
                Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
                <a className="underline" href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer">
                  https://ec.europa.eu/consumers/odr/
                </a>
                .
              </>
            ) : (
              <>
                The European Commission provides a platform for online dispute resolution (ODR):{" "}
                <a className="underline" href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer">
                  https://ec.europa.eu/consumers/odr/
                </a>
                .
              </>
            )}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {isDe ? (
              <>
                LYNIQ Media ist bereit, bei rechtlichen Konflikten mit Verbrauchern (§ 13 BGB) an einem außergerichtlichen
                Schlichtungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Zuständig ist die Allgemeine
                Verbraucherschlichtungsstelle des Zentrums für Schlichtung e.V., Straßburger Straße 8, 77694 Kehl am Rhein,{" "}
                <a className="underline" href="https://www.verbraucher-schlichter.de" target="_blank" rel="noreferrer">
                  www.verbraucher-schlichter.de
                </a>
                .
              </>
            ) : (
              <>
                LYNIQ Media is willing to participate in out-of-court dispute resolution for consumer disputes. The competent
                body is the Allgemeine Verbraucherschlichtungsstelle des Zentrums für Schlichtung e.V., Straßburger Straße 8,
                77694 Kehl am Rhein,{" "}
                <a className="underline" href="https://www.verbraucher-schlichter.de" target="_blank" rel="noreferrer">
                  www.verbraucher-schlichter.de
                </a>
                .
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
