import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { localeFromCookie, LOCALE_COOKIE_NAME } from "../../../../lib/i18n";
import { formatLocaleDateTime } from "../../../../lib/formatDate";
import {
  getCurrentOrganization,
  getCurrentUserRoleInOrg,
  getOrgIdForData,
  isOrgAdmin
} from "../../../../lib/getOrganization";
import { canManageMembersAndTeams } from "../../../../lib/permissions";
import { assertCanManageMembersAndTeams } from "../../../../lib/permissionsServer";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import AdminForbidden from "../AdminForbidden";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

async function createFeedbackAction(formData: FormData) {
  "use server";
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!orgSlug || !title) return;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await assertCanManageMembersAndTeams(orgIdForData))) return;

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  const service = createSupabaseServiceRoleClient();
  let createdBy: string | null = null;
  if (user?.id) {
    const { data: prof } = await service
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("organization_id", orgIdForData)
      .maybeSingle();
    createdBy = (prof as any)?.id ?? null;
  }

  await service.from("feature_requests").insert({
    organization_id: orgIdForData,
    created_by: createdBy,
    title,
    description,
    status: "new",
  });
}

async function updateStatusAction(formData: FormData) {
  "use server";
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!orgSlug || !id || !status) return;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await assertCanManageMembersAndTeams(orgIdForData))) return;

  const service = createSupabaseServiceRoleClient();
  await service.from("feature_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", orgIdForData);
}

export default async function FeedbackAdminPage(props: { params: Promise<{ org: string }> | { org: string } }) {
  const params = typeof (props.params as Promise<{ org: string }>).then === "function"
    ? await (props.params as Promise<{ org: string }>)
    : (props.params as { org: string });
  const orgSlug = params.org;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  const feedbackRole = await getCurrentUserRoleInOrg(orgIdForData);
  if (!canManageMembersAndTeams(feedbackRole)) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }

  const service = createSupabaseServiceRoleClient();
  const { data: items } = await service
    .from("feature_requests")
    .select("id, title, description, status, created_at")
    .eq("organization_id", orgIdForData)
    .order("created_at", { ascending: false })
    .limit(200);

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Feedback" />
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Feedback & feature requests</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Collect requested improvements from your team and track status.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add request</h2>
        <form action={createFeedbackAction} className="mt-3 space-y-3">
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Title</label>
            <input name="title" required className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Description (optional)</label>
            <textarea name="description" rows={3} className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
          </div>
          <button className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Submit</button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
          Requests
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {(items ?? []).map((it: any) => (
            <li key={it.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{it.title}</p>
                  {it.description ? <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{it.description}</p> : null}
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    {formatLocaleDateTime(it.created_at, locale)}
                  </p>
                </div>
                <form action={updateStatusAction} className="flex items-center gap-2">
                  <input type="hidden" name="orgSlug" value={orgSlug} />
                  <input type="hidden" name="id" value={it.id} />
                  <select name="status" defaultValue={it.status} className="rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                    {["new", "planned", "in_progress", "done", "rejected"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
                    Update
                  </button>
                </form>
              </div>
            </li>
          ))}
          {(!items || items.length === 0) && (
            <li className="p-6 text-sm text-gray-600 dark:text-gray-400">No requests yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

