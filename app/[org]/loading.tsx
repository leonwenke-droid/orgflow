import { getRequestLocale } from "../../lib/localeServer";
import { t } from "../../lib/i18n";

export default async function OrgRouteLoading() {
  const locale = await getRequestLocale();

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
      <p className="text-sm font-medium text-text-secondary dark:text-text-muted">{t("common.loading", locale)}</p>
    </div>
  );
}
