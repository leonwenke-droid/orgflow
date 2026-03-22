import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Suspense } from "react";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData, getCurrentUserOrganization } from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import CopyTaskLinkButton from "../../../components/CopyTaskLinkButton";
import SubmitButtonWithSpinner from "../../../components/SubmitButtonWithSpinner";
import CommitteeFilter from "../../../components/CommitteeFilter";
import EmptyState from "../../../components/EmptyState";
import { localeFromCookie, LOCALE_COOKIE_NAME, t as tr } from "../../../lib/i18n";

export const dynamic = "force-dynamic";

const STATUS_COLUMNS = [
  { key: "offen", labelKey: "tasks.status_open" },
  { key: "in_arbeit", labelKey: "tasks.status_in_progress" },
  { key: "erledigt", labelKey: "tasks.status_done" }
] as const;

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

  for (const u of updates) {
    await service.from("tasks").update({ owner_id: u.ownerId }).eq("id", u.taskId).eq("organization_id", orgId);
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

async function deleteTask(formData: FormData) {
  "use server";
  const taskId = formData.get("taskId")?.toString();
  if (!taskId) return;
  const service = createSupabaseServiceRoleClient();
  await service.from("tasks").delete().eq("id", taskId);
  revalidatePath("/admin/tasks");
}

type PageProps = { searchParams?: Promise<{ committee?: string; org?: string; event?: string }> | { committee?: string; org?: string; event?: string } };

export default async function AdminTasksPage(props: PageProps) {
  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const raw = props.searchParams;
  const searchParams = raw && typeof (raw as Promise<unknown>).then === "function"
    ? await (raw as Promise<{ committee?: string; org?: string; event?: string }>)
    : (raw ?? {}) as { committee?: string; org?: string; event?: string };
  const committeeId = searchParams?.committee?.trim() || null;
  const orgSlug = searchParams?.org?.trim() || null;
  const eventIdFilter = searchParams?.event?.trim() || null;
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

  const committeeQuery = service.from("committees").select("id, name").order("name");
  const tasksQuery = service
    .from("tasks")
    .select(
      "id, title, description, status, due_at, committee_id, owner_id, created_by, proof_required, proof_url, access_token, organization_id, event_id, committees ( name )"
    )
    .order("due_at", { ascending: true });
  const profilesQuery = service.from("profiles").select("id, full_name");
  const eventsQuery = orgId
    ? service.from("events").select("id, name").eq("organization_id", orgId).order("name")
    : Promise.resolve({ data: [] as { id: string; name: string }[] });
  if (orgId) {
    committeeQuery.eq("organization_id", orgId);
    tasksQuery.eq("organization_id", orgId);
    profilesQuery.eq("organization_id", orgId);
  }
  if (eventIdFilter) {
    tasksQuery.eq("event_id", eventIdFilter);
  }

  const [{ data: committees }, { data: tasks }, { data: profiles }, { data: eventsList }] = await Promise.all([
    committeeQuery,
    tasksQuery,
    profilesQuery,
    eventsQuery
  ]);
  const events = (eventsList ?? []) as { id: string; name: string }[];

  const profileNames = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])
  );

  const committeesForFilter = (committees ?? []).filter(
    (c: { name?: string | null }) => !/Jahrgangssprecher/i.test(String(c.name ?? ""))
  );

  const tasksFiltered = committeeId
    ? (tasks ?? []).filter((t: { committee_id?: string | null }) => t.committee_id === committeeId)
    : (tasks ?? []);

  const baseTasksUrl = effectiveOrgSlug ? `/admin/tasks?org=${encodeURIComponent(effectiveOrgSlug)}` : "/admin/tasks";
  const baseTasksNewUrl = effectiveOrgSlug ? `/admin/tasks/new?org=${encodeURIComponent(effectiveOrgSlug)}` : "/admin/tasks/new";

  return (
    <div className="space-y-4">
      {effectiveOrgSlug && (
        <AdminBreadcrumb orgSlug={effectiveOrgSlug} currentLabel={tr("dashboard.tasks", locale)} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {tr("tasks.kanban_title", locale)}
          </h2>
          <Suspense fallback={<span className="text-[10px] text-gray-500">Team …</span>}>
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
        <div className="flex items-center gap-2">
          {orgId && (
            <form action={autoAssignTasks} className="inline">
              <input type="hidden" name="organization_id" value={orgId} />
              <input type="hidden" name="org_slug" value={effectiveOrgSlug ?? ""} />
              <SubmitButtonWithSpinner className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-70" loadingLabel="…">
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
      <div className="grid gap-4 md:grid-cols-3">
        {STATUS_COLUMNS.map((col) => (
          <div key={col.key} className="card flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                {tr(col.labelKey, locale)}
              </h3>
              <span className="text-[10px] text-gray-500">
                {tr("tasks.count_tasks", locale).replace("{count}", String(tasksFiltered.filter((t) => t.status === col.key).length))}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              {tasksFiltered
                .filter((t) => t.status === col.key)
                .map((t) => (
                  <article
                    key={t.id}
                    className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-card-dark"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-[11px] font-semibold">
                          {t.title}
                        </h4>
                        <p className="text-[10px] text-gray-600">
                          {tr("tasks.team_label", locale)}: {(t.committees as { name?: string })?.name ?? "–"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-[9px]">
                        {t.due_at && (
                          <span className="rounded bg-gray-100 px-1 py-0.5 text-gray-700">
                            {new Date(t.due_at).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB")}
                          </span>
                        )}
                        <span className="text-gray-500">
                          {t.proof_required
                            ? t.proof_url
                              ? tr("tasks.proof_uploaded", locale)
                              : tr("tasks.proof_missing", locale)
                            : tr("tasks.proof_optional", locale)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 space-y-0.5 text-[10px] text-gray-600">
                      <p>
                        {tr("tasks.created_by", locale)}: {t.created_by ? profileNames.get(t.created_by) ?? "–" : "–"}
                      </p>
                      <p>
                        {tr("tasks.assigned_to", locale)}: {t.owner_id ? profileNames.get(t.owner_id) ?? "–" : tr("tasks.unassigned", locale)}
                      </p>
                    </div>
                    {t.description && (
                      <p className="mt-1 line-clamp-2 text-[10px] text-gray-500">
                        {t.description}
                      </p>
                    )}
                    {(t.proof_url || (t as { access_token?: string }).access_token) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px]">
                        {(t as { access_token?: string }).access_token && (
                          <CopyTaskLinkButton token={(t as { access_token: string }).access_token} />
                        )}
                        {t.proof_url && (
                          <a
                            href={t.proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded bg-blue-100 px-2 py-0.5 text-blue-700 hover:bg-blue-200"
                          >
                            {tr("tasks.view_proof", locale)}
                          </a>
                        )}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-700">
                        {tr(col.labelKey, locale)}
                      </span>
                      <form action={deleteTask} className="inline">
                        <input type="hidden" name="taskId" value={t.id} />
                        <SubmitButtonWithSpinner
                          className="inline-flex items-center gap-1.5 rounded bg-red-100 px-2 py-0.5 text-[9px] text-red-600 hover:bg-red-200 disabled:opacity-70"
                          title={tr("tasks.remove_task_title", locale)}
                          loadingLabel="…"
                        >
                          {tr("tasks.remove_task", locale)}
                        </SubmitButtonWithSpinner>
                      </form>
                    </div>
                  </article>
                ))}
              {!tasksFiltered.filter((t) => t.status === col.key).length && (
                <p className="text-[11px] text-gray-500">
                  {tr("tasks.no_tasks_in_column", locale)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
