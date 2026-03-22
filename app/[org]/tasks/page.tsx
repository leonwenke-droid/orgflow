import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../lib/i18n";
import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import TaskCompleteModalButton from "../../../components/TaskCompleteModal";

export const dynamic = "force-dynamic";

async function claimTaskAction(formData: FormData) {
  "use server";
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const taskId = String(formData.get("taskId") ?? "").trim();
  if (!orgSlug || !taskId) return;

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("claim_task", { task_id: taskId });
  revalidatePath(`/${orgSlug}/tasks`);
  revalidatePath(`/${orgSlug}/dashboard`);
}

async function offerTaskAction(formData: FormData) {
  "use server";
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const taskId = String(formData.get("taskId") ?? "").trim();
  if (!orgSlug || !taskId) return;

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("offer_task", { task_id: taskId });
  revalidatePath(`/${orgSlug}/tasks`);
  revalidatePath(`/${orgSlug}/dashboard`);
}

export default async function TasksViewerPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params = typeof (props.params as Promise<{ org: string }>).then === "function"
    ? await (props.params as Promise<{ org: string }>)
    : (props.params as { org: string });
  const orgSlug = params.org;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  const authSupabase = createServerComponentClient({ cookies });
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/tasks`);

  const service = createSupabaseServiceRoleClient();
  const { data: mePrimary } = await service
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();

  // Legacy/TGG fallback: profiles können unter der "rohen" org.id liegen.
  const { data: meFallback } = (!mePrimary && orgIdForData !== org.id)
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
      <div className="mx-auto max-w-3xl p-6 space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("common.access_denied", locale)}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("dashboard.use_invited_account", locale)}</p>
        </div>
      </div>
    );
  }

  const canClaim = myRole !== "viewer";
  const effectiveOrgIdForData = mePrimary ? orgIdForData : org.id;

  const { data: tasksAll } = await service
    .from("tasks")
    .select(
      "id, title, description, status, due_at, owner_id, claimable, proof_required, proof_url, committees(name)"
    )
    .eq("organization_id", effectiveOrgIdForData)
    .neq("status", "erledigt")
    .order("due_at", { ascending: true });

  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", effectiveOrgIdForData);
  const nameById = new Map((profiles ?? []).map((p: any) => [p.id as string, p.full_name ?? "–"]));

  const openClaimable = (tasksAll ?? []).filter(
    (t: any) =>
      t.owner_id == null &&
      t.claimable === true &&
      (t.status === "offen" || t.status === "in_arbeit")
  );

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("dashboard.tasks", locale)}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{org.name}</p>
        </div>
        <Link href={`/${orgSlug}/dashboard`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          {t("common.back", locale)}
        </Link>
      </div>

      {openClaimable.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t("tasks.open_claimable", locale)}
          </h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {openClaimable.map((task: any) => (
              <li key={task.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(task.committees as any)?.name ?? "–"}
                    {task.due_at ? ` · ${new Date(task.due_at).toLocaleString(locale === "de" ? "de-DE" : "en-GB")}` : ""}
                  </p>
                </div>
                {canClaim ? (
                  <form action={claimTaskAction}>
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="taskId" value={task.id} />
                    <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                      {t("tasks.claim", locale)}
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t("common.unauthorized", locale)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("dashboard.tasks", locale)}
        </h2>
        {(tasksAll ?? []).length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("empty.tasks", locale)}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {(tasksAll ?? []).map((task: any) => {
              const ownedByMe = !!myProfileId && task.owner_id === myProfileId;
              const claimableHere =
                task.owner_id == null &&
                task.claimable === true &&
                (task.status === "offen" || task.status === "in_arbeit");
              return (
                <li key={task.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(task.committees as any)?.name ?? "–"}
                        {task.due_at ? ` · ${new Date(task.due_at).toLocaleString(locale === "de" ? "de-DE" : "en-GB")}` : ""}
                        {task.owner_id ? ` · ${t("tasks.claimed_by", locale)}: ${nameById.get(task.owner_id) ?? "–"}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {claimableHere && canClaim ? (
                        <form action={claimTaskAction}>
                          <input type="hidden" name="orgSlug" value={orgSlug} />
                          <input type="hidden" name="taskId" value={task.id} />
                          <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                            {t("tasks.claim", locale)}
                          </button>
                        </form>
                      ) : null}

                      {ownedByMe ? (
                        <TaskCompleteModalButton
                          orgSlug={orgSlug}
                          task={{
                            id: task.id,
                            title: task.title,
                            description: task.description ?? null,
                            due_at: task.due_at ?? null,
                            status: task.status,
                            proof_required: !!task.proof_required,
                            proof_url: task.proof_url ?? null
                          }}
                          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 shrink-0"
                        />
                      ) : null}

                      {ownedByMe && canClaim ? (
                        <form action={offerTaskAction}>
                          <input type="hidden" name="orgSlug" value={orgSlug} />
                          <input type="hidden" name="taskId" value={task.id} />
                          <button className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
                            {t("tasks.offer", locale)}
                          </button>
                        </form>
                      ) : null}

                      {task.proof_url && (
                        <a
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400 shrink-0"
                          href={task.proof_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("tasks.view_proof", locale)}
                        </a>
                      )}

                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200 shrink-0">
                        {task.status}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

