import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getRequestLocale } from "../../../lib/localeServer";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { t } from "../../../lib/i18n";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import MemberTasksClient from "../../../components/tasks/MemberTasksClient";
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
  // handled client-side via URL param read in MemberTasksClient

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const locale = await getRequestLocale();

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

  const [{ data: tasksAll }, { data: tasksDone }, { data: pendingTransfers }] = await Promise.all([
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
      .limit(200),
    service
      .from("task_transfer_requests")
      .select("task_id")
      .eq("organization_id", effectiveOrgIdForData)
      .eq("status", "pending")
  ]);

  const pendingTaskIds = new Set(
    (pendingTransfers ?? []).map((r: { task_id: string }) => r.task_id)
  );

  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", effectiveOrgIdForData);
  const nameById: Record<string, string> = Object.fromEntries(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "–"])
  );

  const tasks = (tasksAll ?? []).map((tk: any) => ({
    ...tk,
    transferPending: pendingTaskIds.has(tk.id),
  }));
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
    <MemberTasksClient
      orgSlug={orgSlug}
      orgName={org.name}
      locale={locale}
      mine={mineSorted as any}
      claimable={openClaimable as any}
      done={doneList as any}
      nameById={nameById}
      myProfileId={myProfileId}
      canClaim={canClaim}
      claimTaskAction={claimTaskAction}
      offerTaskAction={offerTaskAction}
    />
  );
}
