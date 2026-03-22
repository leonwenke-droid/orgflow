import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import ThemeToggle from "../../../components/ThemeToggle";
import LanguageToggle from "../../../components/LanguageToggle";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../lib/i18n";

export const dynamic = "force-dynamic";

export default async function OrgAccountPage(props: { params: Promise<{ org: string }> | { org: string } }) {
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
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/account`);

  const service = createSupabaseServiceRoleClient();
  let { data: prof } = await service
    .from("profiles")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();
  if (!prof && orgIdForData !== org.id) {
    const { data: p2 } = await service
      .from("profiles")
      .select("id, full_name")
      .eq("auth_user_id", user.id)
      .eq("organization_id", org.id)
      .maybeSingle();
    prof = p2;
  }
  if (!prof) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("dashboard.use_invited_account", locale)}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("account.title", locale)}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t("account.intro", locale)}</p>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            {(prof as { full_name?: string }).full_name ?? user.email}
          </p>
        </div>
        <Link href={`/${orgSlug}/dashboard`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          {t("common.back", locale)}
        </Link>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-muted">
          {t("settings.appearance", locale)}
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t("settings.theme_note", locale)}</p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-muted">
          {t("account.email_heading", locale)}
        </h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">{user.email}</p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("account.email_note", locale)}</p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-muted">
          {t("account.password_reset", locale)}
        </h2>
        <Link
          href="/auth/forgot-password"
          className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t("account.password_reset", locale)}
        </Link>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-muted">
          {t("account.security_heading", locale)}
        </h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">{t("security.2fa_hint", locale)}</p>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t("security.privacy_note", locale)}</p>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t("realtime.optional_note", locale)}</p>
      </section>
    </div>
  );
}
