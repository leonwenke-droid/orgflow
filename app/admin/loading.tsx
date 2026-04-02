import { getRequestLocale } from "../../lib/localeServer";
import { t } from "../../lib/i18n";

/** Skeleton-style loading for /admin/* while server components fetch data. */
export default async function AdminRouteLoading() {
  const locale = await getRequestLocale();

  return (
    <div
      className="mx-auto flex min-h-[40vh] max-w-6xl flex-col gap-4 px-4 py-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-8 w-48 animate-pulse rounded-lg bg-bg-tertiary dark:bg-bg-tertiary" />
      <div className="space-y-3">
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-bg-secondary dark:bg-bg-primary" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded bg-bg-secondary dark:bg-bg-primary" />
        <div className="h-32 w-full animate-pulse rounded-xl border border-border-subtle bg-bg-secondary dark:border-border-default dark:bg-bg-primary/40" />
      </div>
      <p className="text-sm font-medium text-text-secondary dark:text-text-muted">{t("common.loading", locale)}</p>
    </div>
  );
}
