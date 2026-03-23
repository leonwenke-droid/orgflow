import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../lib/i18n";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import EmptyState from "../../../components/EmptyState";
import MemberTaskRow from "../../../components/MemberTaskRow";
import TasksDoneSection from "../../../components/TasksDoneSection";
import { claimTaskAction, offerTaskAction } from "./actions";

export const dynamic = "force-dynamic";

const TASK_SELECT =
  "id, title, description, status, due_at, owner_id, claimable, proof_required, proof_url, committees(name)";

export default async function TasksViewerPage(props: {
  params: Promise<{ org: string }> | { org: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });
  const orgSlug = params.org;
  const sp =
    props.searchParams && typeof (props.searchParams as Promise<unknown>).then === "function"
      ? await (props.searchParams as Promise<Record<string, string | string[] | undefined>>)
      : ((props.searchParams as Record<string, string | string[] | undefined> | undefined) ?? {});
  const taskActionStatus = String(sp.taskAction ?? "").trim();

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  const authSupabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await authSupabase.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/tasks`);

  const service = createSupabaseServiceRoleClient();
  const { data: mePrimary } = await service
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();

  const { data: meFallback } =
    !mePrimary && orgIdForData !== org.id
      ? await service
          .from("profiles")
          .select("id, role")
          .eq("auth_user_id", user.id)
          .eq("organization_id", org.id)
          .maybeSingle()
      : { data: null };

  const myProfile = (mePrimary ?? meFallback) as { id?: string; role?: string } | null;
  const myProfileId = myProfile?.id ?? null;
  const myRole = myProfile?.role ?? null;

  if (!myProfileId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("common.access_denied", locale)}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("dashboard.use_invited_account", locale)}</p>
        </div>
      </div>
    );
  }

  const canClaim = myRole !== "viewer";
  const effectiveOrgIdForData = mePrimary ? orgIdForData : org.id;

  const [{ data: tasksAll }, { data: tasksDone }] = await Promise.all([
    service
      .from("tasks")
      .select(TASK_SELECT)
      .eq("organization_id", effectiveOrgIdForData)
      .neq("status", "erledigt")
      .order("due_at", { ascending: true }),
    service
      .from("tasks")
      .select(TASK_SELECT)
      .eq("organization_id", effectiveOrgIdForData)
      .eq("status", "erledigt")
      .order("due_at", { ascending: false })
      .limit(200)
  ]);

  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", effectiveOrgIdForData);
  const nameById: Record<string, string> = Object.fromEntries(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "–"])
  );

  const tasks = tasksAll ?? [];
  const doneList = tasksDone ?? [];

  const openClaimable = tasks.filter(
    (tk: (typeof tasks)[number]) =>
      tk.owner_id == null &&
      tk.claimable === true &&
      (tk.status === "offen" || tk.status === "in_arbeit")
  );

  const claimableIds = new Set(openClaimable.map((tk: (typeof tasks)[number]) => tk.id as string));

  const mineSorted = tasks
    .filter((tk: (typeof tasks)[number]) => tk.owner_id === myProfileId)
    .slice()
    .sort((a: (typeof tasks)[number], b: (typeof tasks)[number]) => {
      const da = a.due_at ? new Date(a.due_at).getTime() : 0;
      const db = b.due_at ? new Date(b.due_at).getTime() : 0;
      return da - db;
    });

  const otherTasksSorted = tasks
    .filter((tk: (typeof tasks)[number]) => tk.owner_id !== myProfileId && !claimableIds.has(tk.id as string))
    .slice()
    .sort((a: (typeof tasks)[number], b: (typeof tasks)[number]) => {
      const da = a.due_at ? new Date(a.due_at).getTime() : 0;
      const db = b.due_at ? new Date(b.due_at).getTime() : 0;
      return da - db;
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("dashboard.tasks", locale)}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{org.name}</p>
        </div>
        <Link href={`/${orgSlug}/dashboard`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          {t("common.back", locale)}
        </Link>
      </div>
      {taskActionStatus === "claimed" && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100">
          {t("tasks.claim_success", locale)}
        </p>
      )}
      {taskActionStatus === "offered" && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100">
          {t("tasks.offer_success", locale)}
        </p>
      )}
      {taskActionStatus === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100">
          {t("tasks.complete_error", locale)}
        </p>
      )}

      {mineSorted.length > 0 && (
        <div className="rounded-xl border-2 border-blue-300 bg-blue-50/80 p-4 shadow-sm dark:border-blue-700 dark:bg-blue-950/30">
          <h2 className="mb-3 text-sm font-semibold text-blue-900 dark:text-blue-100">{t("tasks.my_tasks_section_title", locale)}</h2>
          <ul className="space-y-3">
            {mineSorted.map((task: (typeof tasks)[number]) => (
              <MemberTaskRow
                key={task.id}
                task={task}
                locale={locale}
                orgSlug={orgSlug}
                myProfileId={myProfileId}
                nameById={nameById}
                canClaim={canClaim}
                claimTaskAction={claimTaskAction}
                offerTaskAction={offerTaskAction}
              />
            ))}
          </ul>
        </div>
      )}

      {openClaimable.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{t("tasks.open_claimable", locale)}</h2>
          <ul className="space-y-3">
            {openClaimable.map((task: (typeof tasks)[number]) => (
              <MemberTaskRow
                key={task.id}
                task={task}
                locale={locale}
                orgSlug={orgSlug}
                myProfileId={myProfileId}
                nameById={nameById}
                canClaim={canClaim}
                claimTaskAction={claimTaskAction}
                offerTaskAction={offerTaskAction}
              />
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {otherTasksSorted.length > 0 ? t("tasks.other_tasks_section", locale) : t("dashboard.tasks", locale)}
        </h2>
        {tasks.length === 0 && doneList.length === 0 ? (
          <EmptyState messageKey="empty.tasks" actionHref={`/${orgSlug}/dashboard`} actionLabelKey="common.back" />
        ) : tasks.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("tasks.no_open_tasks", locale)}</p>
        ) : otherTasksSorted.length === 0 ? (
          <EmptyState messageKey="tasks.no_other_tasks" actionHref={`/${orgSlug}/dashboard`} actionLabelKey="common.back" />
        ) : (
          <ul className="space-y-3">
            {otherTasksSorted.map((task: (typeof tasks)[number]) => (
              <MemberTaskRow
                key={task.id}
                task={task}
                locale={locale}
                orgSlug={orgSlug}
                myProfileId={myProfileId}
                nameById={nameById}
                canClaim={canClaim}
                claimTaskAction={claimTaskAction}
                offerTaskAction={offerTaskAction}
              />
            ))}
          </ul>
        )}
      </div>

      <TasksDoneSection
        doneTasks={doneList}
        locale={locale}
        orgSlug={orgSlug}
        myProfileId={myProfileId}
        nameById={nameById}
        canClaim={canClaim}
        claimTaskAction={claimTaskAction}
        offerTaskAction={offerTaskAction}
      />
    </div>
  );
}
