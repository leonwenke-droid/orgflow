import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../lib/i18n";

export const dynamic = "force-dynamic";

export default async function TasksViewerPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params = typeof (props.params as Promise<{ org: string }>).then === "function"
    ? await (props.params as Promise<{ org: string }>)
    : (props.params as { org: string });
  const orgSlug = params.org;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/tasks`);

  const { data: me } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();

  const myProfileId = (me as { id?: string } | null)?.id ?? null;
  const { data: tasks } = myProfileId
    ? await supabase
        .from("tasks")
        .select("id, title, status, due_at, committees(name)")
        .eq("organization_id", orgIdForData)
        .eq("owner_id", myProfileId)
        .order("due_at", { ascending: true })
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("dashboard.tasks", locale)}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{org.name}</p>
        </div>
        <Link href={`/${orgSlug}/dashboard`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          {t("common.back", locale)}
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        {(tasks ?? []).length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("empty.tasks", locale)}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {(tasks ?? []).map((task: any) => (
              <li key={task.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(task.committees as any)?.name ?? "–"}
                      {task.due_at ? ` · ${new Date(task.due_at).toLocaleString(locale === "de" ? "de-DE" : "en-GB")}` : ""}
                    </p>
                  </div>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {task.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

