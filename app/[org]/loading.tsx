import { cookies } from "next/headers";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../lib/i18n";

export default async function OrgRouteLoading() {
  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400"
        aria-hidden
      />
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t("common.loading", locale)}</p>
    </div>
  );
}
