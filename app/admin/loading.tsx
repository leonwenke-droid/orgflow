import { cookies } from "next/headers";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../lib/i18n";

/** Skeleton-style loading for /admin/* while server components fetch data. */
export default async function AdminRouteLoading() {
  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <div
      className="mx-auto flex min-h-[40vh] max-w-6xl flex-col gap-4 px-4 py-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="space-y-3">
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-32 w-full animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40" />
      </div>
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t("common.loading", locale)}</p>
    </div>
  );
}
