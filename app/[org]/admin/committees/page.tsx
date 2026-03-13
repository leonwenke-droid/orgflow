import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin } from "../../../../lib/getOrganization";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import AdminForbidden from "../AdminForbidden";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import CreateCommitteeForm from "./CreateCommitteeForm";
import CommitteeRow from "./CommitteeRow";

export default async function AdminCommitteesPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params = props.params;
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);
  if (!(await isOrgAdmin(org.id))) return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });
  const { data: committees } = await supabase
    .from("committees")
    .select("id, name")
    .eq("organization_id", org.id)
    .order("name");

  return (
    <div className="mx-auto max-w-4xl p-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Teams" />
      <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Teams – {org.name}</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Create & edit (organisation)</p>

      <CreateCommitteeForm orgSlug={orgSlug} orgId={org.id} committees={committees ?? []} />

      <ul className="mt-6 space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        {(committees ?? []).map((c: { id: string; name: string }) => (
          <CommitteeRow key={c.id} orgSlug={orgSlug} committee={c} />
        ))}
        {(!committees || committees.length === 0) && (
          <li className="text-gray-500 dark:text-gray-400">No teams yet.</li>
        )}
      </ul>
    </div>
  );
}
