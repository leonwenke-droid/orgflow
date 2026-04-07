import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getRequestLocale } from "../../../../../lib/localeServer";
import { cookies } from "next/headers";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../../lib/supabaseServer";
import AdminBreadcrumb from "../../../../../components/AdminBreadcrumb";
import AdminForbidden from "../../AdminForbidden";
import { t } from "../../../../../lib/i18n";
import { formatCalendarDateYmd } from "../../../../../lib/formatDate";
import { formatTaskStatus, type AppLocale } from "../../../../../lib/formatters";

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
  if (!(await isOrgAdmin(orgIdForData, orgSlug))) return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;

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

  const locale = await getRequestLocale();
  const service = createSupabaseServiceRoleClient();

  const [
    { data: eventTasks },
    { data: eventShifts },
    { count: resourcesCount }
  ] = await Promise.all([
    service
      .from("tasks")
      .select("id, title, status")
      .eq("organization_id", orgIdForData)
      .eq("event_id", eventId)
      .order("due_at", { ascending: true })
      .limit(20),
    service
      .from("shifts")
      .select("id, event_name, date, start_time, end_time")
      .eq("organization_id", orgIdForData)
      .eq("event_id", eventId)
      .order("date", { ascending: true })
      .limit(20),
    service
      .from("material_procurements")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .then((r) => ({ count: r.count }))
  ]);

  const tasks = (eventTasks ?? []) as { id: string; title: string; status: string }[];
  const shifts = (eventShifts ?? []) as { id: string; event_name: string; date: string; start_time: string | null; end_time: string | null }[];
  const openTasks = tasks.filter((tk) => tk.status !== "erledigt" && tk.status !== "abgebrochen");
  const doneTasks = tasks.filter((tk) => tk.status === "erledigt");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("events.detail_title", locale).replace("{name}", event.name)} />
      <header>
        <h1 className="page-title">
          {t("events.detail_title", locale).replace("{name}", event.name)}
        </h1>
        {(event.start_date || event.end_date) && (
          <p className="page-sub">
            {event.start_date && formatCalendarDateYmd(event.start_date, locale)}
            {event.end_date && event.end_date !== event.start_date && ` – ${formatCalendarDateYmd(event.end_date, locale)}`}
          </p>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs text-text-secondary">{locale === "de" ? "Aufgaben" : "Tasks"}</p>
          <p className="mt-1 text-2xl font-bold text-text-primary dark:text-foreground-dark">{tasks.length}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {openTasks.length} {locale === "de" ? "offen" : "open"} · {doneTasks.length} {locale === "de" ? "erledigt" : "done"}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary">{locale === "de" ? "Schichten" : "Shifts"}</p>
          <p className="mt-1 text-2xl font-bold text-text-primary dark:text-foreground-dark">{shifts.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-text-secondary">{locale === "de" ? "Ressourcen" : "Resources"}</p>
          <p className="mt-1 text-2xl font-bold text-text-primary dark:text-foreground-dark">{resourcesCount ?? 0}</p>
        </div>
      </div>

      {tasks.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-border-subtle px-4 py-3 dark:border-border-default">
            <div className="section-label">{locale === "de" ? "Aufgaben" : "Tasks"}</div>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {tasks.map((tk) => {
              const statusTag =
                tk.status === "erledigt" ? "tag tag-green" :
                tk.status === "in_arbeit" ? "tag tag-amber" :
                tk.status === "ueberfaellig" ? "tag tag-red" :
                tk.status === "abgebrochen" ? "tag tag-neutral" :
                "tag tag-neutral";
              const loc = locale === "en" ? "en" : "de";
              return (
                <li key={tk.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="min-w-0 truncate text-sm text-text-primary dark:text-text-primary">
                    {tk.title}
                  </span>
                  <span className={statusTag}>{formatTaskStatus(tk.status, loc as AppLocale)}</span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border-subtle px-4 py-2 dark:border-border-default">
            <Link
              href={`/admin/tasks?org=${encodeURIComponent(orgSlug)}&event=${eventId}`}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {t("events.view_tasks", locale)} →
            </Link>
          </div>
        </section>
      )}

      {shifts.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-border-subtle px-4 py-3 dark:border-border-default">
            <div className="section-label">{locale === "de" ? "Schichten" : "Shifts"}</div>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {shifts.map((sh) => (
              <li key={sh.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0 truncate text-sm text-text-primary dark:text-text-primary">
                  {sh.event_name || sh.date}
                </span>
                <span className="text-xs text-text-secondary">
                  {sh.date}{sh.start_time ? ` ${sh.start_time}` : ""}{sh.end_time ? `–${sh.end_time}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border-subtle px-4 py-2 dark:border-border-default">
            <Link
              href={`/admin/shifts?org=${encodeURIComponent(orgSlug)}&event=${eventId}`}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {t("events.view_shifts", locale)} →
            </Link>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${orgSlug}/admin/materials?event=${encodeURIComponent(eventId)}`}
          className="btn-secondary"
        >
          {t("events.view_resources", locale)} ({resourcesCount ?? 0})
        </Link>
        <Link
          href={`/${orgSlug}/admin/events`}
          className="btn-secondary"
        >
          ← {t("events.back_to_events", locale)}
        </Link>
      </div>
    </div>
  );
}
