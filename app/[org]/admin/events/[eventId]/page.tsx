import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../../../lib/getOrganization";
import AdminBreadcrumb from "../../../../../components/AdminBreadcrumb";
import AdminForbidden from "../../AdminForbidden";
import { t, localeFromCookie, LOCALE_COOKIE_NAME } from "../../../../../lib/i18n";

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
    return (
      <div className="mx-auto max-w-4xl p-6">
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Events" />
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">Event not found.</p>
        <Link href={`/${orgSlug}/admin/events`} className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Back to events
        </Link>
      </div>
    );
  }

  const [
    { count: tasksCount },
    { count: shiftsCount }
  ] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("organization_id", orgIdForData).eq("event_id", eventId),
    supabase.from("shifts").select("id", { count: "exact", head: true }).eq("organization_id", orgIdForData).eq("event_id", eventId)
  ]);

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("events.detail_title", locale).replace("{name}", event.name)} />
      <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {t("events.detail_title", locale).replace("{name}", event.name)}
      </h1>
      {(event.start_date || event.end_date) && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {event.start_date && new Date(event.start_date).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB")}
          {event.end_date && event.end_date !== event.start_date && ` – ${new Date(event.end_date).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB")}`}
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
      </div>

      <Link
        href={`/${orgSlug}/admin/events`}
        className="mt-6 inline-block text-sm text-gray-600 hover:underline dark:text-gray-400"
      >
        ← Back to events
      </Link>
    </div>
  );
}
