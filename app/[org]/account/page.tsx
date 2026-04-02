import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getRequestLocale } from "../../../lib/localeServer";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { t } from "../../../lib/i18n";
import AppearanceControls from "../../../components/AppearanceControls";

export const dynamic = "force-dynamic";

export default async function OrgAccountPage(props: { params: Promise<{ org: string }> | { org: string } }) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });
  const orgSlug = params.org;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const locale = await getRequestLocale();

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
        <p className="text-sm text-text-secondary dark:text-text-muted">{t("dashboard.use_invited_account", locale)}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">{locale === "en" ? "My account" : "Mein Konto"}</h1>
          <p className="page-sub">{org.name}</p>
          <p className="mt-3 text-sm text-text-secondary">{(prof as { full_name?: string }).full_name ?? user.email}</p>
        </div>
        <Link href={`/${orgSlug}/dashboard`} className="btn-secondary">
          {t("common.back", locale)}
        </Link>
      </header>

      <section className="card">
        <div className="p-4 space-y-4">
          <div className="section-label">{locale === "en" ? "Appearance & language" : "Darstellung & Sprache"}</div>
          <AppearanceControls showSectionLabels={false} />
        </div>
      </section>

      <section className="card">
        <div className="p-4 space-y-2">
          <div className="section-label">{locale === "en" ? "Email" : "E-Mail"}</div>
          <div className="text-sm text-text-primary">{user.email}</div>
          <div className="text-xs text-text-secondary">{t("account.email_note", locale)}</div>
        </div>
      </section>

      <section className="card">
        <div className="p-4 space-y-3">
          <div className="section-label">{locale === "en" ? "Security" : "Sicherheit"}</div>
          <div className="text-sm text-text-secondary">{t("security.2fa_hint", locale)}</div>
          <div className="flex flex-wrap gap-2">
            <Link href="/auth/forgot-password" className="btn-primary">
              {locale === "en" ? "Reset password" : "Passwort zurücksetzen"}
            </Link>
            <Link href={`/${orgSlug}/feedback`} className="btn-secondary">
              {locale === "en" ? "Send feedback" : "Feedback geben"}
            </Link>
          </div>
          <div className="text-xs text-text-secondary">{t("security.privacy_note", locale)}</div>
        </div>
      </section>

      <section className="card">
        <div className="p-4 space-y-2">
          <div className="section-label">{locale === "en" ? "Realtime" : "Realtime"}</div>
          <div className="text-xs text-text-secondary">{t("realtime.optional_note", locale)}</div>
        </div>
      </section>
    </div>
  );
}
