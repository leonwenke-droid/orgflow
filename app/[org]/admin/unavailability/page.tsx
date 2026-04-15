import { getRequestLocale } from "../../../../lib/localeServer";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import AdminForbidden from "../AdminForbidden";
import { t } from "../../../../lib/i18n";
import UnavailabilityReviewRow from "./UnavailabilityReviewRow";

export const dynamic = "force-dynamic";

export default async function AdminUnavailabilityPage(props: {
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

  const { data: rows } = await service
    .from("member_unavailability")
    .select("id, user_id, unavailable_from, unavailable_until, reason, status, created_at, reviewed_at")
    .eq("organization_id", orgIdForData)
    .order("created_at", { ascending: false })
    .limit(200);

  const list = (rows ?? []) as any[];
  const userIds = [...new Set(list.map((r) => r.user_id))];
  const { data: profiles } =
    userIds.length > 0
      ? await service.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as any[] };

  const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name ?? "—"]));
  const pendingCount = list.filter((r) => r.status === "pending").length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <header>
        <h1 className="page-title">{t("unavailability.page_title", locale)}</h1>
        <p className="page-sub">
          {t("unavailability.page_sub", locale)}
          {pendingCount > 0 ? <span className="ml-2 tag tag-amber">{pendingCount}</span> : null}
        </p>
      </header>

      {list.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-text-secondary">{t("unavailability.empty", locale)}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="-mx-0 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border-subtle dark:border-border-default">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">{t("unavailability.member", locale)}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">{t("unavailability.period", locale)}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">{t("unavailability.reason", locale)}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">{t("transfers.requested", locale)}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">Status</th>
                  <th className="w-44 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <UnavailabilityReviewRow
                    key={r.id}
                    row={r}
                    memberName={nameById.get(r.user_id) ?? "—"}
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
