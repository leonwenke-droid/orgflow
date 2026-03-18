import { cookies } from "next/headers";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../lib/i18n";

export const dynamic = "force-dynamic";

export default async function ImprintPage() {
  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {t("legal.imprint_title", locale)}
      </h1>
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p>
          This is a template imprint page. Replace with your legal entity details (address, registration, contact).
        </p>
        <p>
          Contact: <span className="font-medium">hello@your-domain.tld</span>
        </p>
      </div>
    </div>
  );
}
