import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getRequestLocale } from "../../../lib/localeServer";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { getGreeting, nextEngagementMilestone, formatShiftSlot, type AppLocale } from "../../../lib/formatDate";
import { t } from "../../../lib/i18n";

import { claimShiftFromDashboard } from "./actions";

export const dynamic = "force-dynamic";

type ShiftRow = {
  id: string;
  event_name: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  required_slots: number | null;
  auto_assign: boolean | null;
  claimable: boolean | null;
  shift_assignments: { id: string; user_id: string | null; replacement_user_id: string | null }[] | null;
};

function formatDateSeparator(ymd: string, locale: "de" | "en") {
  const s = String(ymd ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "–";
  const [y, m, d] = s.split("-").map(Number);
  const loc = locale === "en" ? "en-GB" : "de-DE";
  return new Intl.DateTimeFormat(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

function dotClass(free: number) {
  if (free <= 0) return "bg-danger";
  if (free === 1) return "bg-warning";
  return "bg-success";
}

export default async function OrgDashboardPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });

  const orgSlug = params.org;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const locale = await getRequestLocale();
  const fl = locale as AppLocale;

  const authSupabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await authSupabase.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/dashboard`);

  const service = createSupabaseServiceRoleClient();
  const { data: myProfile } = await service
    .from("profiles")
    .select("id, full_name, role")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();

  const member = myProfile as { id?: string; full_name?: string | null; role?: string | null } | null;
  const myProfileId = member?.id ?? null;
  if (!myProfileId) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="card p-6">
          <h1 className="page-title">{t("common.access_denied", locale)}</h1>
          <p className="page-sub">{t("dashboard.use_invited_account", locale)}</p>
        </div>
      </div>
    );
  }

  const canClaimShifts = (member?.role ?? null) !== "viewer";

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const metaName =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) ||
    null;
  const emailLocal = user.email?.split("@")[0]?.trim() || null;
  const myName = (member?.full_name && String(member.full_name).trim()) || metaName || emailLocal || null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);

  const [{ count: openTaskCount }, { data: engagementRows }, { data: shifts }, { data: myAssignments }] = await Promise.all([
    service
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgIdForData)
      .eq("owner_id", myProfileId)
      .neq("status", "erledigt"),
    service
      .from("engagement_scores")
      .select("user_id, score")
      .eq("organization_id", orgIdForData)
      .order("score", { ascending: false }),
    service
      .from("shifts")
      .select(
        "id, event_name, date, start_time, end_time, location, required_slots, auto_assign, claimable, shift_assignments(id, user_id, replacement_user_id)"
      )
      .eq("organization_id", orgIdForData)
      .gte("date", todayStr)
      .lte("date", in7Str)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true }),
    service
      .from("shift_assignments")
      .select("id, user_id, replacement_user_id, shifts!inner(id, organization_id)")
      .or(`user_id.eq.${myProfileId},replacement_user_id.eq.${myProfileId}`)
      .eq("shifts.organization_id", orgIdForData)
  ]);

  const myScoreRow = (engagementRows ?? []).find((row: any) => row.user_id === myProfileId);
  const myEngagementScore = typeof myScoreRow?.score === "number" ? myScoreRow.score : 0;
  const myEngagementRank =
    myScoreRow && engagementRows
      ? 1 + (engagementRows ?? []).filter((row: any) => (row.score ?? 0) > myEngagementScore).length
      : null;
  const engagementTotal = (engagementRows ?? []).length;

  const assignedShiftIds = new Set((myAssignments ?? []).map((a: any) => String(a?.shifts?.id ?? "")).filter(Boolean));

  const upcomingShifts = (shifts ?? []) as ShiftRow[];
  const freeCount = upcomingShifts.filter((s) => {
    const required = Number(s.required_slots ?? 1) || 1;
    const taken = (s.shift_assignments ?? []).length;
    return Math.max(0, required - taken) > 0;
  }).length;

  const grouped = new Map<string, ShiftRow[]>();
  for (const s of upcomingShifts) {
    const key = String(s.date ?? "").slice(0, 10) || "—";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }
  const groupedEntries = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="page-title">{myName ? `${getGreeting(fl)}, ${myName}` : getGreeting(fl)}</h1>
        <p className="page-sub">{locale === "en" ? "Here is what matters today." : "Hier ist, was heute noch wichtig ist."}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Your score" : "Dein Score"}</div>
          <div className="text-2xl font-semibold text-gray-900">{myEngagementScore} Pkt.</div>
          <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
            {(() => {
              const next = nextEngagementMilestone(myEngagementScore);
              const pct = Math.max(0, Math.min(100, Math.round((myEngagementScore / Math.max(1, next)) * 100)));
              return <div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />;
            })()}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {locale === "en"
              ? `Next milestone: ${nextEngagementMilestone(myEngagementScore)} pts.`
              : `Nächster Meilenstein: ${nextEngagementMilestone(myEngagementScore)} Pkt.`}
          </div>
        </div>

        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Org rank" : "Rang in der Org"}</div>
          <div className="text-2xl font-semibold text-gray-900">
            {myEngagementRank != null ? `#${myEngagementRank}` : "—"}
            {myEngagementRank != null ? <span className="text-sm font-medium text-gray-500"> / {engagementTotal}</span> : null}
          </div>
          <div className="mt-2 text-xs text-gray-500">{org.name}</div>
        </div>

        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Open tasks" : "Offene Aufgaben"}</div>
          <div className="text-2xl font-semibold text-warning-dark">{openTaskCount ?? 0}</div>
          <div className="mt-2 text-xs text-gray-500">{locale === "en" ? "Overdue shown in tasks" : "Überfällig in Aufgaben sichtbar"}</div>
        </div>
      </section>

      <section className="card">
        <div className="p-4">
          <div className="section-label">{locale === "en" ? "Today" : "Heute zu tun"}</div>
          {freeCount === 0 && (openTaskCount ?? 0) === 0 ? (
            <p className="text-sm text-gray-600">{locale === "en" ? "All done — no action needed." : "Alles erledigt — kein Handlungsbedarf."}</p>
          ) : (
            <div className="space-y-2">
              {freeCount > 0 ? (
                <div className="flex items-center justify-between gap-3 border-l-4 border-l-brand bg-white px-3 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{locale === "en" ? "Open shifts" : "Schichten mit freien Plätzen"}</div>
                    <div className="text-xs text-gray-500">{freeCount} {locale === "en" ? "shift(s) available" : "Schicht(en) verfügbar"}</div>
                  </div>
                  <Link href={`/${orgSlug}/shifts`} className="btn-secondary">{locale === "en" ? "View" : "Ansehen"}</Link>
                </div>
              ) : null}
              {(openTaskCount ?? 0) > 0 ? (
                <div className="flex items-center justify-between gap-3 border-l-4 border-l-warning bg-white px-3 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{locale === "en" ? "Open tasks" : "Offene Aufgaben"}</div>
                    <div className="text-xs text-gray-500">{openTaskCount ?? 0} {locale === "en" ? "tasks" : "Aufgaben"}</div>
                  </div>
                  <Link href={`/${orgSlug}/tasks`} className="btn-primary">{locale === "en" ? "Do now" : "Erledigen"}</Link>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="section-label">{locale === "en" ? "Upcoming shifts" : "Kommende Schichten"}</div>
            <Link href={`/${orgSlug}/shifts`} className="btn-secondary">{locale === "en" ? "View all" : "Alle ansehen"}</Link>
          </div>

          {upcomingShifts.length === 0 ? (
            <p className="text-sm text-gray-500">—</p>
          ) : (
            <div className="space-y-4">
              {groupedEntries.map(([dateKey, rows]) => (
                <div key={dateKey}>
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                    {dateKey === "—" ? "—" : formatDateSeparator(dateKey, locale)}
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {rows.map((s) => {
                      const required = Number(s.required_slots ?? 1) || 1;
                      const taken = (s.shift_assignments ?? []).length;
                      const free = Math.max(0, required - taken);
                      const assigned = assignedShiftIds.has(String(s.id));
                      const isFull = free <= 0;
                      const showButton = canClaimShifts && !assigned && free > 0 && s.auto_assign !== true && s.claimable !== false;
                      return (
                        <li key={s.id} className={`py-3 ${isFull ? "opacity-60" : ""}`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${dotClass(free)}`} aria-hidden />
                                <span className="text-xs text-gray-500">{free} {locale === "en" ? "free" : "frei"}</span>
                                <span className="font-medium text-gray-900">{s.event_name || t("dashboard.shifts", locale)}</span>
                                {assigned ? <span className="tag tag-blue">{locale === "en" ? "Signed up" : "Eingetragen"}</span> : null}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {s.date ? formatShiftSlot(String(s.date), s.start_time, s.end_time, fl) : "–"}
                                {s.location ? ` · ${s.location}` : ""}
                                {` · ${free} von ${required} ${locale === "en" ? "free" : "frei"}`}
                                {isFull ? ` · ${locale === "en" ? "Full" : "Belegt"}` : ""}
                              </div>
                            </div>
                            {showButton ? (
                              <form action={claimShiftFromDashboard}>
                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                <input type="hidden" name="organization_id" value={orgIdForData} />
                                <input type="hidden" name="shiftId" value={s.id} />
                                <button type="submit" className="btn-primary">{locale === "en" ? "Sign up" : "Eintragen"}</button>
                              </form>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

