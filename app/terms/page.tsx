import { cookies } from "next/headers";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../lib/i18n";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {t("legal.terms_title", locale)}
      </h1>
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p>
          This is a template terms page. Replace with your official Terms of Service before production use.
        </p>
        <p>
          OrgFlow is provided “as is”. Organisations are responsible for the content they upload and the permissions
          they grant to members.
        </p>
      </div>
    </div>
  );
}
