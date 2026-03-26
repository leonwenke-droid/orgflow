import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getRequestLocale } from "../../../../../lib/localeServer";
import { cookies } from "next/headers";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../../../lib/getOrganization";
import AdminBreadcrumb from "../../../../../components/AdminBreadcrumb";
import AdminForbidden from "../../AdminForbidden";
import { t } from "../../../../../lib/i18n";
import { formatCalendarDateYmd } from "../../../../../lib/formatDate";

export const dynamic = "force-dynamic";

export default async function EventDetailPage(props: {
  params: Promise<{ org: string; eventId: string }> | { org: string; eventId: string };
}) {
  const params = typeof (props.params as Promise<{ org: string; eventId: string }>).then === "function"
    ? await (props.params as Promise<{ org: string; eventId: string }>)
    : (props.params as { org: string; eventId: string });
  const { org: orgSlug, eventId } = params;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;

  const supabase = createServerComponentClient({ cookies });
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name, slug, start_date, end_date")
    .eq("id", eventId)
    .eq("organization_id", orgIdForData)
    .single();

  if (eventError || !event) {
    const locale = await getRequestLocale();
    return (
      <div className="mx-auto max-w-4xl p-6">
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("events.title", locale)} />
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{t("events.not_found", locale)}</p>
        <Link href={`/${orgSlug}/admin/events`} className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
          {t("events.back_to_events", locale)}
        </Link>
      </div>
    );
  }

  const [
    { count: tasksCount },
    { count: shiftsCount },
    { count: resourcesCount }
  ] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("organization_id", orgIdForData).eq("event_id", eventId),
    supabase.from("shifts").select("id", { count: "exact", head: true }).eq("organization_id", orgIdForData).eq("event_id", eventId),
    supabase.from("material_procurements").select("id", { count: "exact", head: true }).eq("event_id", eventId)
  ]);

  const locale = await getRequestLocale();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("events.detail_title", locale).replace("{name}", event.name)} />
      <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {t("events.detail_title", locale).replace("{name}", event.name)}
      </h1>
      {(event.start_date || event.end_date) && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {event.start_date && formatCalendarDateYmd(event.start_date, locale)}
          {event.end_date && event.end_date !== event.start_date && ` – ${formatCalendarDateYmd(event.end_date, locale)}`}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href={`/admin/tasks?org=${encodeURIComponent(orgSlug)}&event=${eventId}`}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow dark:border-gray-700 dark:bg-card-dark dark:hover:border-blue-600"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("events.tasks_count", locale)}</h2>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{tasksCount ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("events.view_tasks", locale)}</p>
        </Link>
        <Link
          href={`/admin/shifts?org=${encodeURIComponent(orgSlug)}&event=${eventId}`}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow dark:border-gray-700 dark:bg-card-dark dark:hover:border-blue-600"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("events.shifts_count", locale)}</h2>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{shiftsCount ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("events.view_shifts", locale)}</p>
        </Link>
        <Link
          href={`/admin/materials?org=${encodeURIComponent(orgSlug)}&event=${eventId}`}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow dark:border-gray-700 dark:bg-card-dark dark:hover:border-blue-600"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("events.resources_count", locale)}</h2>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{resourcesCount ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("events.view_resources", locale)}</p>
        </Link>
      </div>

      <Link
        href={`/${orgSlug}/admin/events`}
        className="mt-6 inline-block text-sm text-gray-600 hover:underline dark:text-gray-400"
      >
        ← {t("events.back_to_events", locale)}
      </Link>
    </div>
  );
}
