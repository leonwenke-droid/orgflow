import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin } from "../../../../lib/getOrganization";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import AdminForbidden from "../AdminForbidden";

export default async function AdminTasksPage(props: {
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
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, due_at, committees(name)")
    .eq("organization_id", org.id)
    .order("due_at", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Tasks" />
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Tasks – {org.name}</h1>
      <p className="mt-1 text-sm text-gray-600">Manage (organisation)</p>
      <ul className="mt-6 space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {(tasks ?? []).map((t: { id: string; title: string | null; status: string | null; committees: { name: string | null }[] }) => (
          <li key={t.id} className="flex justify-between text-sm">
            <span className="text-gray-900">{t.title ?? "-"}</span>
            <span className="text-gray-600">
              {t.status ?? "-"} · {t.committees?.[0]?.name ?? "-"}
            </span>
          </li>
        ))}
        {(!tasks || tasks.length === 0) && (
          <li className="text-gray-500">No tasks yet.</li>
        )}
      </ul>
    </div>
  );
}
