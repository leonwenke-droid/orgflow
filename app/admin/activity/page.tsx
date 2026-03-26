import { cookies } from "next/headers";
import { getRequestLocale } from "../../../lib/localeServer";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

import { formatLocaleDateTime } from "../../../lib/formatDate";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin, getCurrentUserOrganization } from "../../../lib/getOrganization";

type PageProps = {
  searchParams?: Promise<{ org?: string }> | { org?: string };
};

export default async function AdminActivityPage(props: PageProps) {
  const raw = props.searchParams;
  const searchParams = raw && typeof (raw as Promise<unknown>).then === "function"
    ? await (raw as Promise<{ org?: string }>)
    : (raw ?? {}) as { org?: string };
  const orgSlug = searchParams?.org?.trim() || null;
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return <p className="text-sm text-amber-300">Please sign in.</p>;

  const service = createSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("organization_id, role")
    .eq("auth_user_id", user.id)
    .single();

  let orgId: string | null = null;
  if (orgSlug) {
    try {
      const org = await getCurrentOrganization(orgSlug);
      const mapped = getOrgIdForData(orgSlug, org.id);
      if (await isOrgAdmin(mapped)) orgId = mapped;
    } catch {
      orgId = null;
    }
  }
  if (!orgId) orgId = (profile as { organization_id?: string | null } | null)?.organization_id ?? null;
  if (!orgId) {
    const userOrg = await getCurrentUserOrganization();
    orgId = userOrg?.id ?? null;
  }
  if (!orgId) return <p className="text-sm text-red-300">No organization context.</p>;
  if (!(await isOrgAdmin(orgId))) return <p className="text-sm text-red-300">Access denied.</p>;

  const { data: logs } = await service
    .from("audit_logs")
    .select("id, action, target_table, target_id, metadata, created_at, actor_profile_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);

  const locale = await getRequestLocale();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Activity log</h1>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-600">
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Actor</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((log: any) => (
              <tr key={log.id} className="border-b border-gray-100">
                <td className="px-3 py-2 text-gray-600">{formatLocaleDateTime(log.created_at, locale)}</td>
                <td className="px-3 py-2 font-medium">{log.action}</td>
                <td className="px-3 py-2">{log.target_table ?? "—"}</td>
                <td className="px-3 py-2">{log.target_id ?? "—"}</td>
                <td className="px-3 py-2">{log.actor_profile_id ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
