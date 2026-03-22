import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../lib/i18n";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function submitFeedbackAction(formData: FormData) {
  "use server";
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!orgSlug || !title) return;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) return;

  const service = createSupabaseServiceRoleClient();
  let { data: prof } = await service
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();
  if (!prof && orgIdForData !== org.id) {
    const { data: p2 } = await service
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("organization_id", org.id)
      .maybeSingle();
    prof = p2;
  }
  if (!prof?.id) return;

  await service.from("feature_requests").insert({
    organization_id: orgIdForData,
    created_by: prof.id as string,
    title,
    description,
    status: "new"
  });
  revalidatePath(`/${orgSlug}/feedback`);
  revalidatePath(`/${orgSlug}/admin/feedback`);
}

async function updateStatusAction(formData: FormData) {
  "use server";
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!orgSlug || !id || !status) return;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return;

  const service = createSupabaseServiceRoleClient();
  await service
    .from("feature_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgIdForData);
  revalidatePath(`/${orgSlug}/feedback`);
  revalidatePath(`/${orgSlug}/admin/feedback`);
}

export default async function OrgFeedbackPage(props: { params: Promise<{ org: string }> | { org: string } }) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });
  const orgSlug = params.org;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/feedback`);

  const service = createSupabaseServiceRoleClient();
  let { data: prof } = await service
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();
  if (!prof && orgIdForData !== org.id) {
    const { data: p2 } = await service
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("organization_id", org.id)
      .maybeSingle();
    prof = p2;
  }
  if (!prof) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("dashboard.use_invited_account", locale)}</p>
      </div>
    );
  }

  const isAdmin = await isOrgAdmin(orgIdForData);

  const { data: items } = await supabase
    .from("feature_requests")
    .select("id, title, description, status, created_at")
    .eq("organization_id", orgIdForData)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("feedback.page_title", locale)}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t("feedback.page_intro", locale)}</p>
        </div>
        <Link href={`/${orgSlug}/dashboard`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          {t("common.back", locale)}
        </Link>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("feedback.new_request", locale)}</h2>
        <form action={submitFeedbackAction} className="mt-3 space-y-3">
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t("tasks.title_label", locale)}
            </label>
            <input
              name="title"
              required
              className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t("tasks.description_label", locale)}
            </label>
            <textarea
              name="description"
              rows={3}
              className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {t("feedback.submit", locale)}
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
          {t("nav.feedback", locale)}
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {(items ?? []).map((it: any) => (
            <li key={it.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{it.title}</p>
                  {it.description ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{it.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    {new Date(it.created_at).toLocaleString(locale === "de" ? "de-DE" : "en-GB")}
                  </p>
                </div>
                {isAdmin ? (
                  <form action={updateStatusAction} className="flex items-center gap-2">
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="id" value={it.id} />
                    <select
                      name="status"
                      defaultValue={it.status}
                      className="rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {["new", "planned", "in_progress", "done", "rejected"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      {t("common.save", locale)}
                    </button>
                  </form>
                ) : (
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {it.status}
                  </span>
                )}
              </div>
            </li>
          ))}
          {(!items || items.length === 0) && (
            <li className="p-6 text-sm text-gray-600 dark:text-gray-400">—</li>
          )}
        </ul>
      </section>
    </div>
  );
}
