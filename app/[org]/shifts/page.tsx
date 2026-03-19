import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../lib/i18n";

export const dynamic = "force-dynamic";

export default async function ShiftsViewerPage(props: {
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
  const localeForDate = locale === "de" ? "de-DE" : "en-GB";

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/shifts`);

  const { data: me } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();
  const myProfileId = (me as { id?: string } | null)?.id ?? null;

  const { data: shifts } = myProfileId
    ? await supabase
        .from("shifts")
        .select("id, event_name, date, start_time, end_time, location, shift_assignments(id, user_id, replacement_user_id, status)")
        .eq("organization_id", orgIdForData)
        .order("date", { ascending: true })
    : { data: [] };

  const myShifts = (shifts ?? []).filter((s: any) =>
    (s.shift_assignments ?? []).some((a: any) => a.user_id === myProfileId || a.replacement_user_id === myProfileId)
  );

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("dashboard.shifts", locale)}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{org.name}</p>
        </div>
        <Link href={`/${orgSlug}/dashboard`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          {t("common.back", locale)}
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        {myShifts.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("empty.shifts", locale)}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {myShifts.map((s: any) => (
              <li key={s.id} className="py-3">
                <p className="font-medium text-gray-900 dark:text-gray-100">{s.event_name || t("dashboard.shifts", locale)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {s.date ? new Date(s.date).toLocaleDateString(localeForDate) : "–"} · {s.start_time ?? ""}-{s.end_time ?? ""}
                  {s.location ? ` · ${s.location}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

