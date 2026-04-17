import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../../../../lib/localeServer";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import {
  getCurrentOrganization,
  getCurrentUserOrganization,
  getOrgIdForData,
  isOrgAdmin,
  resolvePlanningConsoleProfile
} from "../../../../lib/getOrganization";
import SubmitButtonWithSpinner from "../../../../components/SubmitButtonWithSpinner";
import { t as tr } from "../../../../lib/i18n";
import { formatLocaleDateTime } from "../../../../lib/formatDate";
import { isMissingSoftDeleteColumnError } from "../../../../lib/supabaseSoftDelete";
import { restoreTask } from "../kanban-actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?:
    | Promise<{ org?: string }>
    | { org?: string };
};

export default async function AdminTasksTrashPage(props: PageProps) {
  const locale = await getRequestLocale();
  const raw = props.searchParams;
  const searchParams =
    raw && typeof (raw as Promise<unknown>).then === "function"
      ? await (raw as Promise<{ org?: string }>)
      : (raw ?? {}) as { org?: string };
  const orgSlug = searchParams?.org?.trim() || null;

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
        <a href={loginHref} className="underline">
          {tr("common.sign_in", locale)}
        </a>
        .
      </p>
    );
  }

  const service = createSupabaseServiceRoleClient();
  const planningProfile = await resolvePlanningConsoleProfile(userId, orgSlug);

  if (
    !planningProfile ||
    !["admin", "lead", "super_admin", "owner", "teamlead"].includes(planningProfile.role)
  ) {
    return <p className="text-sm text-red-300">{tr("tasks.access_admin_only", locale)}</p>;
  }

  let orgId: string | null = null;
  if (orgSlug) {
    try {
      const org = await getCurrentOrganization(orgSlug);
      const orgIdForData = getOrgIdForData(orgSlug, org.id);
      if (await isOrgAdmin(orgIdForData, orgSlug)) orgId = orgIdForData;
    } catch {
      orgId = null;
    }
  }
  if (!orgId && planningProfile.organization_id) orgId = planningProfile.organization_id;

  let effectiveOrgSlug = orgSlug;
  if (!effectiveOrgSlug && orgId) {
    const userOrg = await getCurrentUserOrganization();
    effectiveOrgSlug = userOrg?.slug ?? null;
  }

  let deletedTasks: { id: string; title?: string | null; deleted_at?: string | null }[] = [];
  if (orgId) {
    let q = service
      .from("tasks")
      .select("id, title, deleted_at")
      .eq("organization_id", orgId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(100);
    const res = await q;
    if (res.error && isMissingSoftDeleteColumnError(res.error.message)) {
      deletedTasks = [];
    } else if (!res.error) {
      deletedTasks = (res.data ?? []) as typeof deletedTasks;
    }
  }

  const baseTasksUrl = effectiveOrgSlug
    ? `/admin/tasks?org=${encodeURIComponent(effectiveOrgSlug)}`
    : "/admin/tasks";

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Breadcrumb">
        {effectiveOrgSlug && (
          <>
            <Link
              href={`/${effectiveOrgSlug}/dashboard`}
              className="text-text-secondary transition hover:text-text-primary dark:text-text-muted dark:hover:text-text-primary"
            >
              Dashboard
            </Link>
            <span className="text-text-muted dark:text-text-secondary" aria-hidden>
              ·
            </span>
            <Link
              href={`/${effectiveOrgSlug}/admin`}
              className="text-text-secondary transition hover:text-text-primary dark:text-text-muted dark:hover:text-text-primary"
            >
              Admin
            </Link>
            <span className="text-text-muted dark:text-text-secondary" aria-hidden>
              ·
            </span>
          </>
        )}
        <Link
          href={baseTasksUrl}
          className="text-text-secondary transition hover:text-text-primary dark:text-text-muted dark:hover:text-text-primary"
        >
          {tr("tasks.trash_breadcrumb_parent", locale)}
        </Link>
        <span className="text-text-muted dark:text-text-secondary" aria-hidden>
          ·
        </span>
        <span className="text-text-primary">{tr("tasks.trash_title", locale)}</span>
      </nav>

      <h2 className="text-sm font-semibold text-text-secondary">{tr("tasks.trash_title", locale)}</h2>

      {!orgId && (
        <p className="text-sm text-text-muted">{tr("tasks.no_organization", locale)}</p>
      )}

      {orgId && deletedTasks.length === 0 && (
        <p className="text-sm text-text-muted">{tr("tasks.trash_empty", locale)}</p>
      )}

      {orgId && deletedTasks.length > 0 && (
        <div className="card space-y-2">
          {deletedTasks.map((task) => (
            <form
              key={task.id}
              action={restoreTask}
              className="flex items-center justify-between gap-2 rounded border border-border-subtle px-3 py-2 text-xs dark:border-border-default"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {task.title?.trim() ? task.title : tr("tasks.untitled_task", locale)}
                </p>
                <p className="text-text-secondary">
                  {task.deleted_at
                    ? formatLocaleDateTime(task.deleted_at, locale)
                    : tr("tasks.empty_value", locale)}
                </p>
              </div>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="organization_id" value={orgId} />
              <input type="hidden" name="org_slug" value={effectiveOrgSlug ?? ""} />
              <SubmitButtonWithSpinner
                className="btn-secondary px-2 py-1 text-xs"
                loadingLabel={tr("common.loading", locale)}
              >
                {tr("common.restore", locale)}
              </SubmitButtonWithSpinner>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
