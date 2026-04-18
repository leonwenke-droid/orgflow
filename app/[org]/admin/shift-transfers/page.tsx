import { getRequestLocale } from "../../../../lib/localeServer";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import AdminForbidden from "../AdminForbidden";
import { t } from "../../../../lib/i18n";
import ShiftTransferRow from "./ShiftTransferRow";

export const dynamic = "force-dynamic";

export default async function AdminShiftTransfersPage(props: { params: Promise<{ org: string }> | { org: string } }) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });
  const orgSlug = params.org;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData, orgSlug))) return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;

  const locale = await getRequestLocale();
  const service = createSupabaseServiceRoleClient();

  const { data: requests } = await service
    .from("shift_transfer_requests")
    .select("id, assignment_id, from_user_id, status, created_at")
    .eq("organization_id", orgIdForData)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (requests ?? []) as any[];

  const assignmentIds = [...new Set(rows.map((r) => r.assignment_id))];
  const profileIds = [...new Set(rows.map((r) => r.from_user_id).filter(Boolean))];

  const [{ data: assignments }, { data: profiles }] = await Promise.all([
    assignmentIds.length
      ? service
          .from("shift_assignments")
          .select("id, shift_id, shifts(event_name, date, start_time, end_time)")
          .in("id", assignmentIds)
      : Promise.resolve({ data: [] as any[] }),
    profileIds.length ? service.from("profiles").select("id, full_name").in("id", profileIds) : Promise.resolve({ data: [] as any[] })
  ]);

  const shiftLabelByAssignmentId = new Map(
    (assignments ?? []).map((a: any) => {
      const sh = a.shifts ?? null;
      const name = sh?.event_name ?? "Shift";
      const date = sh?.date ? String(sh.date).slice(0, 10) : "";
      const st = String(sh?.start_time ?? "").slice(0, 5);
      return [String(a.id), `${name}${date ? ` · ${date}` : ""}${st ? ` ${st}` : ""}`];
    })
  );
  const nameById = new Map((profiles ?? []).map((p: any) => [String(p.id), String(p.full_name ?? "—")]));

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <header>
        <h1 className="page-title">{t("shift_transfers.page_title", locale)}</h1>
        <p className="page-sub">
          {t("shift_transfers.page_sub", locale)}
          {pendingCount > 0 ? <span className="ml-2 tag tag-amber">{pendingCount}</span> : null}
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-text-secondary">{t("shift_transfers.empty", locale)}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="-mx-0 overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b border-border-subtle dark:border-border-default">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">{t("shift_transfers.shift", locale)}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">{t("transfers.from", locale)}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">{t("transfers.requested", locale)}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">Status</th>
                  <th className="w-40 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <ShiftTransferRow
                    key={r.id}
                    request={r}
                    shiftTitle={shiftLabelByAssignmentId.get(String(r.assignment_id)) ?? "—"}
                    fromName={nameById.get(String(r.from_user_id)) ?? "—"}
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

