import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin } from "../../../../lib/getOrganization";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import AdminForbidden from "../AdminForbidden";

export default async function AdminShiftsPage({
  params
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);
  if (!(await isOrgAdmin(org.id))) return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });
  const { data: shifts } = await supabase
    .from("shifts")
    .select("id, event_name, date, start_time, end_time")
    .eq("organization_id", org.id)
    .order("date", { ascending: true })
    .limit(50);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Shifts" />
      <h1 className="mt-4 text-2xl font-bold text-cyan-100">Shifts – {org.name}</h1>
      <p className="mt-1 text-sm text-cyan-300">Plan (organisation)</p>
      <ul className="mt-6 space-y-2 rounded-lg border border-cyan-500/30 bg-card p-4">
        {(shifts ?? []).map((s: any) => (
          <li key={s.id} className="flex justify-between text-sm">
            <span className="text-cyan-100">{s.event_name ?? "-"} · {s.date}</span>
            <span className="text-cyan-400/80">{s.start_time}–{s.end_time}</span>
          </li>
        ))}
        {(!shifts || shifts.length === 0) && (
          <li className="text-cyan-400/80">No shifts yet.</li>
        )}
      </ul>
    </div>
  );
}
