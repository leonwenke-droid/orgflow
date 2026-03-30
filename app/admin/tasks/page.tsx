import { cookies } from "next/headers";
import { getRequestLocale } from "../../../lib/localeServer";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Suspense } from "react";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { createUserNotification } from "../../../lib/notifications";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData, getCurrentUserOrganization } from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import SubmitButtonWithSpinner from "../../../components/SubmitButtonWithSpinner";
import CommitteeFilter from "../../../components/CommitteeFilter";
import EmptyState from "../../../components/EmptyState";
import { t as tr } from "../../../lib/i18n";
import { formatLocaleDateTime } from "../../../lib/formatDate";
import { isMissingSoftDeleteColumnError } from "../../../lib/supabaseSoftDelete";
import AdminTasksKanban from "./AdminTasksKanban";
import { restoreTask } from "./kanban-actions";
import RealtimeRefreshBridge from "../../../components/RealtimeRefreshBridge";

export const dynamic = "force-dynamic";

async function autoAssignTasks(formData: FormData) {
  "use server";
  const orgId = formData.get("organization_id")?.toString() || null;
  const orgSlug = formData.get("org_slug")?.toString() || null;
  if (!orgId) return;

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: adminOk } = await supabase.rpc("is_org_admin", { org_id: orgId });
  if (adminOk !== true) return;

  const service = createSupabaseServiceRoleClient();

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

  // Round-robin over sorted-by-load list (deterministic per run)
  let idx = 0;
  for (const taskId of taskIds) {
    const member = eligible[idx % eligible.length];
    updates.push({ taskId, ownerId: member.id });
    increments.set(member.id, (increments.get(member.id) ?? 0) + 1);
    idx++;
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

  for (const u of updates) {
    await service.from("tasks").update({ owner_id: u.ownerId }).eq("id", u.taskId).eq("organization_id", orgId);
    await createUserNotification(service, {
      profileId: u.ownerId,
      organizationId: orgId,
      type: "task_assigned",
      title: "Neue Aufgabe zugewiesen",
      body: taskTitles.get(u.taskId) || "Du hast eine neue Aufgabe erhalten.",
      link: orgSlug ? `/${orgSlug}/tasks` : null
    });
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
  const locale = await getRequestLocale();
  const raw = props.searchParams;
  const searchParams = raw && typeof (raw as Promise<unknown>).then === "function"
    ? await (raw as Promise<{ committee?: string; org?: string; event?: string; q?: string }>)
    : (raw ?? {}) as { committee?: string; org?: string; event?: string; q?: string };
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
  const { data: profile } = await service
    .from("profiles")
    .select("id, role, organization_id")
    .eq("auth_user_id", userId)
    .single();

  if (!profile || !["admin", "lead", "super_admin", "owner"].includes(profile.role)) {
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
      if (await isOrgAdmin(orgIdForData)) orgId = orgIdForData;
    } catch {
      orgId = null;
    }
  }
  if (!orgId && profile.organization_id) orgId = profile.organization_id;

  let effectiveOrgSlug = orgSlug;
  if (!effectiveOrgSlug && orgId) {
    const userOrg = await getCurrentUserOrganization();
    effectiveOrgSlug = userOrg?.slug ?? null;
  }

  await service.rpc("apply_task_missed_penalties");

  const TASK_SELECT =
    "id, title, description, status, due_at, committee_id, owner_id, created_by, proof_required, proof_url, access_token, organization_id, event_id, committees ( name )";

  const committeeQuery = service.from("committees").select("id, name").order("name");
  const profilesQuery = service.from("profiles").select("id, full_name");
  const eventsQuery = orgId
    ? service.from("events").select("id, name").eq("organization_id", orgId).order("name")
    : Promise.resolve({ data: [] as { id: string; name: string }[] });
  if (orgId) {
    committeeQuery.eq("organization_id", orgId);
    profilesQuery.eq("organization_id", orgId);
  }

  const [{ data: committees }, { data: profiles }, { data: eventsList }] = await Promise.all([
    committeeQuery,
    profilesQuery,
    eventsQuery
  ]);

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

  let deletedTasksQuery = service
    .from("tasks")
    .select("id, title, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(50);
  if (orgId) {
    deletedTasksQuery = deletedTasksQuery.eq("organization_id", orgId);
  }
  const deletedTasksRes = await deletedTasksQuery;
  const deletedTasks =
    deletedTasksRes.error && isMissingSoftDeleteColumnError(deletedTasksRes.error.message)
      ? []
      : (deletedTasksRes.data ?? []);
  const events = (eventsList ?? []) as { id: string; name: string }[];

  const profileNames = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])
  );

  const committeesForFilter = (committees ?? []).filter(
    (c: { name?: string | null }) => !/Jahrgangssprecher/i.test(String(c.name ?? ""))
  );

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

  const profileNamesObj = Object.fromEntries(profileNames) as Record<string, string>;

  return (
    <div className="space-y-4">
      {tasksLoadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200" role="alert">
          {tasksLoadError.message}
        </p>
      )}
      {effectiveOrgSlug && (
        <AdminBreadcrumb orgSlug={effectiveOrgSlug} currentLabel={tr("dashboard.tasks", locale)} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {tr("tasks.kanban_title", locale)}
          </h2>
          <Suspense fallback={<span className="text-[10px] text-gray-500">Filter …</span>}>
            <CommitteeFilter committees={committeesForFilter} />
          </Suspense>
          {events.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Link
                href={baseTasksUrl}
                className={`rounded px-2.5 py-1 ${!eventIdFilter ? "bg-blue-100 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"}`}
              >
                {tr("tasks.all_events", locale)}
              </Link>
              {events.map((ev) => (
                <Link
                  key={ev.id}
                  href={`${baseTasksUrl}&event=${encodeURIComponent(ev.id)}`}
                  className={`rounded px-2.5 py-1 ${eventIdFilter === ev.id ? "bg-blue-100 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"}`}
                >
                  {ev.name}
                </Link>
              ))}
            </div>
          )}
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2 text-xs">
          {effectiveOrgSlug && <input type="hidden" name="org" value={effectiveOrgSlug} />}
          {committeeId && <input type="hidden" name="committee" value={committeeId} />}
          {eventIdFilter && <input type="hidden" name="event" value={eventIdFilter} />}
          <label className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <span>{tr("tasks.filter_search", locale)}</span>
            <input
              type="search"
              name="q"
              defaultValue={qInput}
              placeholder={tr("tasks.filter_search_placeholder", locale)}
              className="min-w-[140px] rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <button
            type="submit"
            className="btn-secondary px-2 py-1 text-xs"
          >
            {tr("common.ok", locale)}
          </button>
        </form>
        <div className="flex items-center gap-2">
          {orgId && (
            <form action={autoAssignTasks} className="inline">
              <input type="hidden" name="organization_id" value={orgId} />
              <input type="hidden" name="org_slug" value={effectiveOrgSlug ?? ""} />
              <SubmitButtonWithSpinner className="btn-primary px-3 py-1.5 text-xs" loadingLabel="…">
                {tr("tasks.run_auto_assignment", locale)}
              </SubmitButtonWithSpinner>
            </form>
          )}
          <Link href={baseTasksNewUrl} className="btn-primary text-xs">
            {tr("cta.create_task", locale)}
          </Link>
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
      {(deletedTasks?.length ?? 0) > 0 && orgId && (
        <section className="card">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{tr("tasks.trash_title", locale)}</h3>
          <div className="space-y-2">
            {(deletedTasks ?? []).map((task: { id: string; title?: string | null; deleted_at?: string | null }) => (
              <form key={task.id} action={restoreTask} className="flex items-center justify-between gap-2 rounded border border-gray-200 px-3 py-2 text-xs dark:border-gray-700">
                <div className="min-w-0">
                  <p className="truncate font-medium">{task.title || "Untitled task"}</p>
                  <p className="text-gray-500">
                    {task.deleted_at ? formatLocaleDateTime(task.deleted_at, locale) : "—"}
                  </p>
                </div>
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="organization_id" value={orgId} />
                <SubmitButtonWithSpinner className="btn-secondary px-2 py-1 text-xs" loadingLabel="…">
                  {tr("common.restore", locale)}
                </SubmitButtonWithSpinner>
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
