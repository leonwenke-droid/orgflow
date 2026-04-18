import { cookies } from "next/headers";
import { getRequestLocale } from "../../../lib/localeServer";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Suspense } from "react";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { createUserNotification } from "../../../lib/notifications";
import { sendTaskAssigned } from "../../../lib/n8n";
import { getPublicOriginSync } from "../../../lib/publicBaseUrl";
import { fetchEngagementEnabledForOrgId } from "../../../lib/engagement/isEngagementEnabled";
import {
  getCurrentOrganization,
  isOrgAdmin,
  getOrgIdForData,
  getCurrentUserOrganization,
  resolvePlanningConsoleProfile
} from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import SubmitButtonWithSpinner from "../../../components/SubmitButtonWithSpinner";
import CommitteeFilter from "../../../components/CommitteeFilter";
import EmptyState from "../../../components/EmptyState";
import { t as tr } from "../../../lib/i18n";
import { isMissingSoftDeleteColumnError } from "../../../lib/supabaseSoftDelete";
import { getKanbanColumnForTask } from "../../../lib/taskKanbanColumns";
import AdminTasksKanban from "./AdminTasksKanban";
import RealtimeRefreshBridge from "../../../components/RealtimeRefreshBridge";
import NewTaskModal from "./NewTaskModal";
import { createTask } from "./createTaskAction";

export const dynamic = "force-dynamic";

function pickRandomWithoutReplacement<T>(rows: T[], count: number): T[] {
  const a = [...rows];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, Math.min(count, a.length)));
}

async function autoAssignTasks(formData: FormData) {
  "use server";
  const orgId = formData.get("organization_id")?.toString() || null;
  const orgSlug = formData.get("org_slug")?.toString() || null;
  const requestedRaw = (formData.get("mode")?.toString() || "").trim();
  let mode: "auto" | "rotation" | "random" =
    requestedRaw === "rotation" ? "rotation" : requestedRaw === "random" ? "random" : "auto";
  if (!orgId) return;

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: adminOk } = await supabase.rpc("is_org_admin", { org_id: orgId });
  if (adminOk !== true) return;

  const service = createSupabaseServiceRoleClient();
  const engagementEnabled = await fetchEngagementEnabledForOrgId(service, orgId).catch(() => false);
  if (!engagementEnabled && mode === "auto") mode = "rotation";

  const { data: tasks } = await service
    .from("tasks")
    .select("id")
    .eq("organization_id", orgId)
    .is("owner_id", null)
    .eq("claimable", true)
    .in("status", ["offen", "in_arbeit"])
    .order("due_at", { ascending: true });

  const taskIds = (tasks ?? []).map((t: any) => t.id as string).filter(Boolean);
  if (taskIds.length === 0) {
    revalidatePath("/admin/tasks");
    if (orgSlug) revalidatePath(`/admin/tasks?org=${encodeURIComponent(orgSlug)}`);
    return;
  }

  const [{ data: profiles }, { data: counters }] = await Promise.all([
    service.from("profiles").select("id, role, status").eq("organization_id", orgId),
    service.from("user_counters").select("user_id, load_index, responsibility_malus")
  ]);

  const loadMap = new Map(
    (counters ?? []).map((c: any) => [
      c.user_id as string,
      { load: Number(c.load_index) ?? 0, malus: Number(c.responsibility_malus) ?? 0 }
    ])
  );

  const eligible = (profiles ?? [])
    .filter((p: any) => p.status !== "disabled" && p.role !== "viewer")
    .map((p: any) => {
      const c = loadMap.get(p.id as string) ?? { load: 0, malus: 0 };
      return { id: p.id as string, load: c.load, malus: c.malus };
    })
    .sort((a, b) => (a.load - b.load) || (a.malus - b.malus) || a.id.localeCompare(b.id));

  if (eligible.length === 0) return;

  const updates: { taskId: string; ownerId: string }[] = [];
  const increments = new Map<string, number>();

  if (mode === "rotation") {
    // Greedy: always pick the currently lowest-load member (updates in-memory each assignment).
    const current = new Map<string, { load: number; malus: number }>(
      eligible.map((m) => [m.id, { load: m.load, malus: m.malus }])
    );
    const order = [...eligible].map((m) => m.id);
    for (const taskId of taskIds) {
      order.sort((a, b) => {
        const A = current.get(a) ?? { load: 0, malus: 0 };
        const B = current.get(b) ?? { load: 0, malus: 0 };
        return (A.load - B.load) || (A.malus - B.malus) || a.localeCompare(b);
      });
      const ownerId = order[0];
      if (!ownerId) continue;
      updates.push({ taskId, ownerId });
      increments.set(ownerId, (increments.get(ownerId) ?? 0) + 1);
      const cur = current.get(ownerId) ?? { load: 0, malus: 0 };
      current.set(ownerId, { ...cur, load: cur.load + 1 });
    }
  } else {
    // Round-robin assignment over a member list:
    // - auto: deterministic sorted-by-load
    // - random: shuffled once per run
    const list = mode === "random" ? pickRandomWithoutReplacement(eligible, eligible.length) : eligible;
    let idx = 0;
    for (const taskId of taskIds) {
      const member = list[idx % list.length];
      updates.push({ taskId, ownerId: member.id });
      increments.set(member.id, (increments.get(member.id) ?? 0) + 1);
      idx++;
    }
  }

  const taskTitles = new Map<string, string>();
  if (updates.length > 0) {
    const { data: titleRows } = await service
      .from("tasks")
      .select("id, title")
      .in(
        "id",
        updates.map((x) => x.taskId)
      )
      .eq("organization_id", orgId);
    for (const row of titleRows ?? []) {
      taskTitles.set((row as { id: string }).id, String((row as { title?: string }).title ?? ""));
    }
  }

  const base = getPublicOriginSync();
  const taskUrl = orgSlug ? `${base}/${orgSlug}/tasks` : undefined;

  for (const u of updates) {
    await service.from("tasks").update({ owner_id: u.ownerId }).eq("id", u.taskId).eq("organization_id", orgId);
    await createUserNotification(service, {
      profileId: u.ownerId,
      organizationId: orgId,
      type: "task_assigned",
      title: "Task assigned successfully",
      body: taskTitles.get(u.taskId) || "You have been assigned a new task.",
      link: orgSlug ? `/${orgSlug}/tasks` : null
    });

    const [{ data: assignedProfile }, { data: taskRow }, { data: orgRow }] = await Promise.all([
      service.from("profiles").select("email, full_name").eq("id", u.ownerId).maybeSingle(),
      service.from("tasks").select("title, description, due_at").eq("id", u.taskId).maybeSingle(),
      service.from("organizations").select("name").eq("id", orgId).maybeSingle()
    ]);
    const em = (assignedProfile as { email?: string | null } | null)?.email;
    if (em) {
      void sendTaskAssigned({
        email: em,
        fullName: (assignedProfile as { full_name?: string | null } | null)?.full_name ?? undefined,
        taskTitle: (taskRow as { title?: string } | null)?.title ?? "Task",
        description: (taskRow as { description?: string | null } | null)?.description ?? undefined,
        dueAt: (taskRow as { due_at?: string | null } | null)?.due_at
          ? new Date(String((taskRow as { due_at: string }).due_at)).toLocaleString("de-DE", {
              dateStyle: "medium",
              timeStyle: "short"
            })
          : undefined,
        orgName: (orgRow as { name?: string } | null)?.name ?? "OrgFlow",
        orgSlug: orgSlug ?? "",
        taskUrl
      }).catch(() => {});
    }
  }

  for (const [uid, inc] of increments.entries()) {
    const current = loadMap.get(uid)?.load ?? 0;
    await service
      .from("user_counters")
      .update({ load_index: current + inc, updated_at: new Date().toISOString() })
      .eq("user_id", uid);
  }

  revalidatePath("/admin/tasks");
  if (orgSlug) revalidatePath(`/admin/tasks?org=${encodeURIComponent(orgSlug)}`);
}

type PageProps = {
  searchParams?:
    | Promise<{ committee?: string; org?: string; event?: string; q?: string }>
    | { committee?: string; org?: string; event?: string; q?: string };
};

export default async function AdminTasksPage(props: PageProps) {
  const raw = props.searchParams;
  const [locale, searchParams] = await Promise.all([
    getRequestLocale(),
    raw && typeof (raw as Promise<unknown>).then === "function"
      ? (raw as Promise<{ committee?: string; org?: string; event?: string; q?: string }>)
      : Promise.resolve((raw ?? {}) as { committee?: string; org?: string; event?: string; q?: string })
  ]);
  const committeeId = searchParams?.committee?.trim() || null;
  const orgSlug = searchParams?.org?.trim() || null;
  const eventIdFilter = searchParams?.event?.trim() || null;
  const qInput = (searchParams?.q ?? "").trim();
  const qRaw = qInput.toLowerCase();
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    const loginHref = orgSlug ? `/${orgSlug}/login` : "/";
    return (
      <p className="text-sm text-amber-300">
        {tr("tasks.session_missing", locale)}{" "}
        <a href={loginHref} className="underline">{tr("common.sign_in", locale)}</a>.
      </p>
    );
  }

  const service = createSupabaseServiceRoleClient();
  const profile = await resolvePlanningConsoleProfile(userId, orgSlug);

  if (!profile) {
    return (
      <p className="text-sm text-red-300">
        {tr("tasks.access_admin_only", locale)}
      </p>
    );
  }

  let orgId: string | null = null;
  if (orgSlug) {
    try {
      const org = await getCurrentOrganization(orgSlug);
      const orgIdForData = getOrgIdForData(orgSlug, org.id);
      // Fast-path: use direct profile lookup (isOrgAdmin now has a fast org-scoped path).
      if (await isOrgAdmin(orgIdForData, orgSlug)) orgId = orgIdForData;
    } catch {
      orgId = null;
    }
  }
  if (!orgId && profile.organization_id) orgId = profile.organization_id;
  const engagementEnabled = orgId ? await fetchEngagementEnabledForOrgId(service, orgId).catch(() => false) : false;

  let effectiveOrgSlug = orgSlug;
  if (!effectiveOrgSlug && orgId) {
    const userOrg = await getCurrentUserOrganization();
    effectiveOrgSlug = userOrg?.slug ?? null;
  }

  await service.rpc("apply_task_missed_penalties");

  const TASK_SELECT =
    "id, title, description, status, due_at, committee_id, owner_id, created_by, proof_required, proof_url, access_token, organization_id, event_id, committees ( name ), events ( name )";

  const committeeQuery = service.from("committees").select("id, name").order("name");
  const profilesQuery = service.from("profiles").select("id, full_name, committee_id").order("full_name");
  const eventsQuery = orgId
    ? service.from("events").select("id, name").eq("organization_id", orgId).order("name")
    : Promise.resolve({ data: [] as { id: string; name: string }[] });
  const profileCommitteesQuery = service.from("profile_committees").select("user_id, committee_id");
  if (orgId) {
    committeeQuery.eq("organization_id", orgId);
    profilesQuery.eq("organization_id", orgId);
  }

  const [{ data: committees }, { data: profiles }, { data: eventsList }, { data: profileCommittees }] =
    await Promise.all([committeeQuery, profilesQuery, eventsQuery, profileCommitteesQuery]);

  function buildTasksQuery(includeDeletedFilter: boolean) {
    let q = service.from("tasks").select(TASK_SELECT).order("due_at", { ascending: true });
    if (orgId) {
      q = q.eq("organization_id", orgId);
    }
    if (eventIdFilter) {
      q = q.eq("event_id", eventIdFilter);
    }
    if (includeDeletedFilter) {
      q = q.is("deleted_at", null);
    }
    return q;
  }

  let tasksRes = await buildTasksQuery(true);
  if (tasksRes.error && isMissingSoftDeleteColumnError(tasksRes.error.message)) {
    tasksRes = await buildTasksQuery(false);
  }
  const tasks = tasksRes.data;
  const tasksLoadError = tasksRes.error && !isMissingSoftDeleteColumnError(tasksRes.error.message) ? tasksRes.error : null;

  let deletedTrashCount = 0;
  if (orgId) {
    const deletedCountRes = await service
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("deleted_at", "is", null);
    if (!deletedCountRes.error) {
      deletedTrashCount = deletedCountRes.count ?? 0;
    } else if (isMissingSoftDeleteColumnError(deletedCountRes.error.message)) {
      deletedTrashCount = 0;
    }
  }
  const events = (eventsList ?? []) as { id: string; name: string }[];

  const profileNames = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])
  );

  const committeesForFilter = committees ?? [];

  const tasksByCommittee = committeeId
    ? (tasks ?? []).filter((t: { committee_id?: string | null }) => t.committee_id === committeeId)
    : (tasks ?? []);

  const tasksFiltered = qRaw
    ? tasksByCommittee.filter((t: { title?: string | null }) =>
        String(t.title ?? "")
          .toLowerCase()
          .includes(qRaw)
      )
    : tasksByCommittee;

  const baseTasksUrl = effectiveOrgSlug ? `/admin/tasks?org=${encodeURIComponent(effectiveOrgSlug)}` : "/admin/tasks";
  const baseTasksNewUrl = effectiveOrgSlug ? `/admin/tasks/new?org=${encodeURIComponent(effectiveOrgSlug)}` : "/admin/tasks/new";
  const baseTasksTrashUrl = effectiveOrgSlug
    ? `/admin/tasks/trash?org=${encodeURIComponent(effectiveOrgSlug)}`
    : "/admin/tasks/trash";

  const columnCounts = {
    offen: 0,
    in_arbeit: 0,
    erledigt: 0,
    ueberfaellig: 0
  };
  for (const task of tasksFiltered) {
    columnCounts[getKanbanColumnForTask(task)]++;
  }
  let statsLine = tr("tasks.stats_summary", locale);
  for (const [key, val] of Object.entries({
    open: columnCounts.offen,
    in_progress: columnCounts.in_arbeit,
    done: columnCounts.erledigt,
    overdue: columnCounts.ueberfaellig
  })) {
    statsLine = statsLine.replace(`{${key}}`, String(val));
  }

  const profileNamesObj = Object.fromEntries(profileNames) as Record<string, string>;

  const userIdToCommitteeIds = new Map<string, string[]>();
  for (const pc of profileCommittees ?? []) {
    const uid = String((pc as { user_id: string }).user_id);
    const cid = String((pc as { committee_id: string }).committee_id);
    if (!userIdToCommitteeIds.has(uid)) userIdToCommitteeIds.set(uid, []);
    userIdToCommitteeIds.get(uid)!.push(cid);
  }
  const committeeListForForm = (committees ?? []).map((c: { id: unknown; name?: string | null }) => ({
    id: String(c.id),
    name: String(c.name ?? "")
  }));
  const membersForForm = (profiles ?? []).map((m: { id: unknown; full_name?: string | null; committee_id?: string | null }) => ({
    id: String(m.id),
    full_name: String(m.full_name ?? ""),
    committee_id: m.committee_id != null ? String(m.committee_id) : null,
    committee_ids: userIdToCommitteeIds.get(String(m.id)) ?? []
  }));

  return (
    <div className="space-y-4">
      {tasksLoadError && (
        <p className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--bg-danger-subtle)] px-3 py-2 text-sm text-[var(--color-danger-text)]" role="alert">
          {tasksLoadError.message}
        </p>
      )}
      {effectiveOrgSlug && (
        <AdminBreadcrumb orgSlug={effectiveOrgSlug} currentLabel={tr("dashboard.tasks", locale)} />
      )}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-secondary">
              {tr("tasks.kanban_title", locale)}
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">{statsLine}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {orgId && (
              <Link
                href={baseTasksTrashUrl}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                {tr("tasks.trash_link", locale).replace("{count}", String(deletedTrashCount))}
              </Link>
            )}
            {orgId && (
              <form action={autoAssignTasks} className="inline">
                <input type="hidden" name="organization_id" value={orgId} />
                <input type="hidden" name="org_slug" value={effectiveOrgSlug ?? ""} />
                <select
                  name="mode"
                  defaultValue={engagementEnabled ? "auto" : "rotation"}
                  className="sh-fill-mode-select mr-2"
                  aria-label={tr("tasks.auto_assign_mode_label", locale)}
                  title={tr("tasks.auto_assign_mode_tooltip", locale)}
                >
                  {engagementEnabled ? (
                    <option value="auto">{tr("tasks.auto_assign_mode_auto", locale)}</option>
                  ) : null}
                  <option value="rotation">{tr("tasks.auto_assign_mode_rotation", locale)}</option>
                  <option value="random">{tr("tasks.auto_assign_mode_random", locale)}</option>
                </select>
                <SubmitButtonWithSpinner
                  className="btn-primary px-3 py-1.5 text-xs"
                  loadingLabel={tr("common.loading", locale)}
                >
                  {tr("tasks.run_auto_assignment", locale)}
                </SubmitButtonWithSpinner>
              </form>
            )}
            {orgId ? (
              <NewTaskModal
                action={createTask}
                organizationId={orgId}
                orgSlug={effectiveOrgSlug ?? undefined}
                committeeList={committeeListForForm}
                members={membersForForm}
                eventsList={events}
              />
            ) : (
              <Link href={baseTasksNewUrl} className="btn-primary text-xs">
                {tr("cta.create_task", locale)}
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Suspense fallback={<span className="text-[10px] text-text-secondary">{tr("common.loading", locale)}</span>}>
            <CommitteeFilter committees={committeesForFilter} />
          </Suspense>
          {events.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Link
                href={baseTasksUrl}
                className="ui-pill"
                aria-current={!eventIdFilter ? "page" : undefined}
              >
                {tr("tasks.all_events", locale)}
              </Link>
              {events.map((ev) => (
                <Link
                  key={ev.id}
                  href={`${baseTasksUrl}&event=${encodeURIComponent(ev.id)}`}
                  className="ui-pill"
                  aria-current={eventIdFilter === ev.id ? "page" : undefined}
                >
                  {ev.name}
                </Link>
              ))}
            </div>
          )}
          <form method="get" className="flex flex-wrap items-center gap-2 text-xs">
            {effectiveOrgSlug && <input type="hidden" name="org" value={effectiveOrgSlug} />}
            {committeeId && <input type="hidden" name="committee" value={committeeId} />}
            {eventIdFilter && <input type="hidden" name="event" value={eventIdFilter} />}
            <label className="flex items-center gap-1 text-text-secondary">
              <span>{tr("tasks.filter_search", locale)}</span>
              <input
                type="search"
                name="q"
                defaultValue={qInput}
                placeholder={tr("tasks.filter_search_placeholder", locale)}
                className="ui-input min-w-[160px] px-2 py-1 text-xs"
              />
            </label>
            <button type="submit" className="btn-secondary px-2 py-1 text-xs">
              {tr("common.ok", locale)}
            </button>
          </form>
        </div>
      </div>

      {tasksFiltered.length === 0 && (
        <EmptyState
          messageKey="empty.tasks"
          actionHref={baseTasksNewUrl}
          actionLabelKey="cta.create_task"
        />
      )}
      {tasksFiltered.length > 0 && (
        <AdminTasksKanban tasks={tasksFiltered} orgId={orgId} orgSlug={effectiveOrgSlug} profileNames={profileNamesObj} />
      )}
      <RealtimeRefreshBridge organizationId={orgId} table="tasks" />
    </div>
  );
}
