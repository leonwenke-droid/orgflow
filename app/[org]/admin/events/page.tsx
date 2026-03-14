import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin } from "../../../../lib/getOrganization";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import AdminForbidden from "../AdminForbidden";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import CreateEventForm from "./CreateEventForm";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage(props: {
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
  const { data: events } = await supabase
    .from("events")
    .select("id, name, slug, start_date, end_date, created_at")
    .eq("organization_id", org.id)
    .order("start_date", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Events" />
      <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Events – {org.name}</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Create events to group shifts, tasks and resources (e.g. Summer Festival 2026).
      </p>

      <CreateEventForm orgSlug={orgSlug} orgId={org.id} />

      <ul className="mt-6 space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        {(events ?? []).map((e: { id: string; name: string; slug: string; start_date: string | null; end_date: string | null }) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <span className="font-medium text-gray-900 dark:text-gray-100">{e.name}</span>
              <span className="ml-2 text-gray-500 dark:text-gray-400">/{e.slug}</span>
              {(e.start_date || e.end_date) && (
                <span className="ml-2 text-xs text-gray-500">
                  {e.start_date && new Date(e.start_date).toLocaleDateString()}
                  {e.end_date && e.end_date !== e.start_date && ` – ${new Date(e.end_date).toLocaleDateString()}`}
                </span>
              )}
            </div>
            <Link
              href={`/${orgSlug}/admin/shifts?event=${e.id}`}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              View shifts
            </Link>
          </li>
        ))}
        {(!events || events.length === 0) && (
          <li className="text-gray-500 dark:text-gray-400">No events yet. Create one above.</li>
        )}
      </ul>
    </div>
  );
}
