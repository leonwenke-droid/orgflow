import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getRequestLocale } from "../../../lib/localeServer";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { redirectViewerToOrgOverview } from "../../../lib/viewerRouteGuard";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { getGreeting, formatShiftSlot, type AppLocale } from "../../../lib/formatDate";
import { t } from "../../../lib/i18n";

import { claimShiftFromDashboard } from "./actions";
import { effectiveAssignmentKind } from "../../../lib/shiftAssignmentKind";
import SubmitButtonWithSpinner from "../../../components/SubmitButtonWithSpinner";
import { getEngagementBreakdown, getOrgScoreboard, getRecentEngagementEvents } from "../../../lib/engagement/getScore";
import EngagementScoreWidget from "../../../components/engagement/EngagementScoreWidget";
import { isEngagementEnabledFromOrgRow } from "../../../lib/engagement/isEngagementEnabled";

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
  assignment_kind?: string | null;
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
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });

  const sp =
    props.searchParams && typeof (props.searchParams as Promise<unknown>).then === "function"
      ? await (props.searchParams as Promise<Record<string, string | string[] | undefined>>)
      : ((props.searchParams as Record<string, string | string[] | undefined> | undefined) ?? {});
  const claimRaw = Array.isArray(sp.claimShift) ? sp.claimShift[0] : sp.claimShift;
  const claimShiftNotice =
    claimRaw === "unavailable" || claimRaw === "error" ? claimRaw : undefined;

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
  redirectViewerToOrgOverview(orgSlug, member?.role ?? null);
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

  const engagementEnabled = isEngagementEnabledFromOrgRow(org as any);

  const [{ count: openTaskCount }, engagementRowsResult, { data: shifts }, { data: myAssignments }] = await Promise.all([
    service
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgIdForData)
      .eq("owner_id", myProfileId)
      .is("deleted_at", null)
      .neq("status", "erledigt"),
    engagementEnabled
      ? service
          .from("engagement_scores")
          .select("user_id, score")
          .eq("organization_id", orgIdForData)
          .order("score", { ascending: false })
      : Promise.resolve({ data: null as { user_id: string; score: number }[] | null }),
    service
      .from("shifts")
      .select(
        "id, event_name, date, start_time, end_time, location, required_slots, auto_assign, claimable, assignment_kind, shift_assignments(id, user_id, replacement_user_id)"
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

  const engagementRows = engagementRowsResult?.data ?? null;

  const myScoreRow = (engagementRows ?? []).find((row: any) => row.user_id === myProfileId);
  const myEngagementScore = typeof myScoreRow?.score === "number" ? myScoreRow.score : 0;
  const myEngagementScoreDisplay = Math.max(0, Number(myEngagementScore) || 0);
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
    const free = Math.max(0, required - taken);
    // "Open shifts" should mean: you could still sign up (not already assigned/replacing).
    const alreadyMine = assignedShiftIds.has(String(s.id));
    return free > 0 && !alreadyMine;
  }).length;

  const grouped = new Map<string, ShiftRow[]>();
  for (const s of upcomingShifts) {
    const key = String(s.date ?? "").slice(0, 10) || "—";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }
  const groupedEntries = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const [breakdown, recentEvents, orgScoreboard] = engagementEnabled
    ? await Promise.all([
        getEngagementBreakdown(service, myProfileId, orgIdForData),
        getRecentEngagementEvents(service, myProfileId, orgIdForData, 24),
        getOrgScoreboard(service, orgIdForData)
      ])
    : [null, null, null];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="page-title">{myName ? `${getGreeting(fl)}, ${myName}` : getGreeting(fl)}</h1>
        <p className="page-sub">{locale === "en" ? "Here is what matters today." : "Hier ist, was heute noch wichtig ist."}</p>
      </header>

      {claimShiftNotice ? (
        <div
          className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--bg-danger-subtle)] px-4 py-3 text-sm text-[var(--color-danger-text)]"
          role="alert"
        >
          {claimShiftNotice === "unavailable"
            ? t("shifts.claim_blocked_unavailable", locale)
            : t("dashboard.claim_shift_failed", locale)}
        </div>
      ) : null}

      <section
        className={`grid gap-4 ${engagementEnabled ? "md:grid-cols-3" : "md:grid-cols-1"}`}
      >
        {engagementEnabled && breakdown != null && recentEvents != null && orgScoreboard != null ? (
          <>
            <EngagementScoreWidget
              totalScore={myEngagementScoreDisplay}
              breakdown={breakdown}
              recentEvents={recentEvents}
              orgScoreboard={orgScoreboard}
              profileId={myProfileId}
              displayName={myName}
            />
            <div className="stat-card">
              <div className="section-label">{locale === "en" ? "Org rank" : "Rang in der Org"}</div>
              <div className="text-2xl font-semibold text-text-primary dark:text-foreground-dark">
                {myEngagementRank != null ? `#${myEngagementRank}` : "—"}
                {myEngagementRank != null ? <span className="text-sm font-medium text-text-secondary"> / {engagementTotal}</span> : null}
              </div>
              <div className="mt-2 text-xs text-text-secondary">{org.name}</div>
              <div className="mt-2 text-[11px] text-text-secondary">
                {locale === "en"
                  ? "Tip: If you just joined, your rank may take a moment to reflect new activity."
                  : "Tipp: Wenn du gerade erst beigetreten bist, kann es kurz dauern, bis neue Aktivität im Rang sichtbar wird."}
              </div>
            </div>
          </>
        ) : null}

        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Open tasks" : "Offene Aufgaben"}</div>
          <div className="text-2xl font-semibold text-warning-dark">{openTaskCount ?? 0}</div>
          <div className="mt-2 text-xs text-text-secondary">{locale === "en" ? "Overdue shown in tasks" : "Überfällig in Aufgaben sichtbar"}</div>
        </div>
      </section>

      <section className="card">
        <div className="p-4">
          <div className="section-label">{locale === "en" ? "Today" : "Heute zu tun"}</div>
          {freeCount === 0 && (openTaskCount ?? 0) === 0 ? (
            <p className="text-sm text-text-secondary">{locale === "en" ? "All done — no action needed." : "Alles erledigt — kein Handlungsbedarf."}</p>
          ) : (
            <div className="space-y-2">
              {freeCount > 0 ? (
                <div className="flex items-center justify-between gap-3 border-l-4 border-l-brand bg-bg-primary px-3 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-text-primary">{locale === "en" ? "Open shifts" : "Schichten mit freien Plätzen"}</div>
                    <div className="text-xs text-text-secondary">{freeCount} {locale === "en" ? "shift(s) available" : "Schicht(en) verfügbar"}</div>
                  </div>
                  <Link href={`/${orgSlug}/shifts`} className="btn-secondary">{locale === "en" ? "View" : "Ansehen"}</Link>
                </div>
              ) : null}
              {(openTaskCount ?? 0) > 0 ? (
                <div className="flex items-center justify-between gap-3 border-l-4 border-l-warning bg-bg-primary px-3 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-text-primary">{locale === "en" ? "Open tasks" : "Offene Aufgaben"}</div>
                    <div className="text-xs text-text-secondary">{openTaskCount ?? 0} {locale === "en" ? "tasks" : "Aufgaben"}</div>
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
            <p className="text-sm text-text-secondary">—</p>
          ) : (
            <div className="space-y-4">
              {groupedEntries.map(([dateKey, rows]) => (
                <div key={dateKey}>
                  <div className="rounded-lg bg-bg-secondary px-3 py-2 text-sm font-medium text-text-secondary">
                    {dateKey === "—" ? "—" : formatDateSeparator(dateKey, locale)}
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {rows.map((s) => {
                      const required = Number(s.required_slots ?? 1) || 1;
                      const taken = (s.shift_assignments ?? []).length;
                      const free = Math.max(0, required - taken);
                      const assigned = assignedShiftIds.has(String(s.id));
                      const isFull = free <= 0;
                      const showButton =
                        canClaimShifts &&
                        !assigned &&
                        free > 0 &&
                        effectiveAssignmentKind(s) === "self_signup";
                      return (
                        <li key={s.id} className={`py-3 ${isFull ? "opacity-60" : ""}`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${dotClass(free)}`} aria-hidden />
                                <span className="text-xs text-text-secondary">{free} {locale === "en" ? "free" : "frei"}</span>
                                <span className="font-medium text-text-primary">{s.event_name || t("dashboard.shifts", locale)}</span>
                                {assigned ? <span className="tag tag-blue">{locale === "en" ? "Signed up" : "Eingetragen"}</span> : null}
                              </div>
                              <div className="mt-1 text-xs text-text-secondary">
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
                                <SubmitButtonWithSpinner
                                  className="btn-primary"
                                  loadingLabel={t("common.loading", locale)}
                                >
                                  {t("shifts.claim", locale)}
                                </SubmitButtonWithSpinner>
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

