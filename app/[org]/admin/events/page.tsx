import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getRequestLocale } from "../../../../lib/localeServer";
import { cookies } from "next/headers";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import AdminForbidden from "../AdminForbidden";
import { t } from "../../../../lib/i18n";
import { formatCalendarDateYmd } from "../../../../lib/formatDate";
import CreateEventForm from "./CreateEventForm";

export const dynamic = "force-dynamic";

function dateOnly(v: string | null | undefined) {
  return String(v ?? "").slice(0, 10);
}

function dateBoxParts(ymd: string | null | undefined, locale: string) {
  const s = dateOnly(ymd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { day: "–", mon: "—" };
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const loc = locale === "en" ? "en-GB" : "de-DE";
  const mon = new Intl.DateTimeFormat(loc, { month: "short" }).format(dt);
  return { day: String(d), mon };
}

export default async function AdminEventsPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params = props.params;
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;

  const locale = await getRequestLocale();

  const supabase = createServerComponentClient({ cookies });
  const { data: events } = await supabase
    .from("events")
    .select("id, name, slug, start_date, end_date, created_at")
    .eq("organization_id", orgIdForData)
    .order("start_date", { ascending: false });

  const eventIds = (events ?? []).map((e: any) => e.id as string);
  const service = createSupabaseServiceRoleClient();
  const [{ data: shiftRows }, { data: taskRows }] = await Promise.all([
    eventIds.length > 0
      ? service.from("shifts").select("id, event_id").eq("organization_id", orgIdForData).in("event_id", eventIds)
      : Promise.resolve({ data: [] as any[] }),
    eventIds.length > 0
      ? service.from("tasks").select("id, event_id, status").eq("organization_id", orgIdForData).in("event_id", eventIds)
      : Promise.resolve({ data: [] as any[] })
  ]);

  const shiftsCountByEvent: Record<string, number> = {};
  for (const r of shiftRows ?? []) {
    const id = String((r as any).event_id ?? "");
    if (!id) continue;
    shiftsCountByEvent[id] = (shiftsCountByEvent[id] ?? 0) + 1;
  }

  const openTasksByEvent: Record<string, number> = {};
  for (const r of taskRows ?? []) {
    const id = String((r as any).event_id ?? "");
    if (!id) continue;
    const st = String((r as any).status ?? "");
    if (st === "erledigt" || st === "abgebrochen") continue;
    openTasksByEvent[id] = (openTasksByEvent[id] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header>
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("events.title", locale)} />
        <h1 className="page-title">{t("events.title", locale)}</h1>
        <p className="page-sub">{org.name}</p>
      </header>

      <div className="card p-4">
        <div className="section-label">{locale === "en" ? "New event" : "Neue Veranstaltung"}</div>
        <CreateEventForm orgId={org.id} />
      </div>

      <div className="space-y-3">
        {(events ?? []).map((e: { id: string; name: string; start_date: string | null; end_date: string | null }) => {
          const start = e.start_date;
          const { day, mon } = dateBoxParts(start, locale);
          const isPast = !!start && dateOnly(start) < dateOnly(new Date().toISOString());
          const plannedShifts = shiftsCountByEvent[e.id] ?? 0;
          const openTasks = openTasksByEvent[e.id] ?? 0;
          return (
            <div key={e.id} className="card">
              <div className="flex flex-wrap items-center gap-4 p-4">
                <div
                  className={`flex h-12 w-12 flex-col items-center justify-center rounded-lg border text-center ${
                    isPast ? "border-border-subtle bg-bg-secondary text-text-secondary" : "border-brand-light bg-brand-light text-brand-dark"
                  }`}
                >
                  <div className="text-sm font-semibold leading-none">{day}</div>
                  <div className="text-[10px] font-medium leading-none">{mon}</div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium text-text-primary">{e.name}</div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {start ? formatCalendarDateYmd(start, locale) : "—"}
                    {e.end_date && e.end_date !== start ? ` – ${formatCalendarDateYmd(e.end_date, locale)}` : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="tag tag-green">{plannedShifts} {locale === "en" ? "shifts planned" : "Schichten geplant"}</span>
                    <span className="tag tag-amber">{openTasks} {locale === "en" ? "tasks open" : "Aufgaben offen"}</span>
                    <span className="tag tag-neutral">{locale === "en" ? "In planning" : "In Planung"}</span>
                  </div>
                </div>

                <Link href={`/${orgSlug}/admin/events/${e.id}`} className="btn-secondary">
                  {locale === "en" ? "Open" : "Öffnen"}
                </Link>
              </div>
            </div>
          );
        })}

        {(!events || events.length === 0) ? (
          <div className="card p-4">
            <p className="text-sm text-text-secondary">{t("events.empty", locale)}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
