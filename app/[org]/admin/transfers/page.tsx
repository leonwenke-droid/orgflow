import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { getRequestLocale } from "../../../../lib/localeServer";
import {
  getCurrentOrganization,
  getOrgIdForData,
  isOrgAdmin,
} from "../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import AdminForbidden from "../AdminForbidden";
import { t } from "../../../../lib/i18n";
import TransferRow from "./TransferRow";

export const dynamic = "force-dynamic";

export default async function AdminTransfersPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });
  const orgSlug = params.org;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData, orgSlug)))
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;

  const locale = await getRequestLocale();
  const service = createSupabaseServiceRoleClient();

  const { data: requests } = await service
    .from("task_transfer_requests")
    .select(
      "id, task_id, from_user_id, to_user_id, status, created_at, reviewed_at, reviewed_by"
    )
    .eq("organization_id", orgIdForData)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (requests ?? []) as any[];

  const taskIds = [...new Set(rows.map((r) => r.task_id))];
  const profileIds = [
    ...new Set(
      rows.flatMap((r: any) =>
        [r.from_user_id, r.to_user_id, r.reviewed_by].filter(Boolean)
      )
    ),
  ];

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    taskIds.length > 0
      ? service.from("tasks").select("id, title").in("id", taskIds)
      : Promise.resolve({ data: [] as any[] }),
    profileIds.length > 0
      ? service
          .from("profiles")
          .select("id, full_name")
          .in("id", profileIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const taskById = new Map(
    (tasks ?? []).map((t: any) => [t.id, t.title ?? "—"])
  );
  const nameById = new Map(
    (profiles ?? []).map((p: any) => [p.id, p.full_name ?? "—"])
  );

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <header>
        <h1 className="page-title">{t("transfers.page_title", locale)}</h1>
        <p className="page-sub">
          {t("transfers.page_sub", locale)}
          {pendingCount > 0 ? (
            <span className="ml-2 tag tag-amber">{pendingCount}</span>
          ) : null}
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-text-secondary">
            {t("transfers.empty", locale)}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="-mx-0 overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border-subtle dark:border-border-default">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    {t("transfers.task", locale)}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    {t("transfers.from", locale)}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    {t("transfers.to", locale)}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    {t("transfers.requested", locale)}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">
                    Status
                  </th>
                  <th className="w-40 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <TransferRow
                    key={r.id}
                    request={r}
                    taskTitle={taskById.get(r.task_id) ?? "—"}
                    fromName={nameById.get(r.from_user_id) ?? "—"}
                    toName={
                      r.to_user_id
                        ? nameById.get(r.to_user_id) ?? "—"
                        : t("transfers.to", locale)
                    }
                    reviewerName={
                      r.reviewed_by
                        ? nameById.get(r.reviewed_by) ?? "—"
                        : null
                    }
                    orgSlug={orgSlug}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
