import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getRequestLocale } from "../../../lib/localeServer";
import { cookies } from "next/headers";
import Link from "next/link";
import { getCurrentOrganization, getEffectiveUserRoleForOrg, getOrgIdForData } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { canChangeOrgSettings } from "../../../lib/permissions";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import AdminForbidden from "../admin/AdminForbidden";
import EditOrgForm from "./EditOrgForm";
import ModuleToggles from "./ModuleToggles";
import PrivacyActions from "./PrivacyActions";
import { t } from "../../../lib/i18n";
import BillingSection from "./BillingSection";
import AppearanceControls from "../../../components/AppearanceControls";
import RotationSettingsForm from "../../../components/RotationSettingsForm";

export default async function OrgSettingsPage({
  params
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const orgSlug =
    typeof (params as Promise<{ org: string }>).then === "function"
      ? (await (params as Promise<{ org: string }>)).org
      : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);

  const settingsRole = await getEffectiveUserRoleForOrg(orgSlug, org);
  if (!canChangeOrgSettings(settingsRole)) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }
  const canSeeBilling = settingsRole === "owner" || settingsRole === "super_admin";

  const locale = await getRequestLocale();

  const billingEmail =
    process.env.NEXT_PUBLIC_ENTERPRISE_BILLING_EMAIL?.trim() ||
    String((org.settings as { contact_email?: string })?.contact_email ?? "").trim();
  const enterpriseMailto = billingEmail
    ? `mailto:${billingEmail}?subject=${encodeURIComponent(`OrgFlow Enterprise — ${org.name}`)}`
    : null;

  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const service = createSupabaseServiceRoleClient();
  const { count: billingMemberCount } = await service
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgIdForData);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("dashboard.settings", locale)} />
        <h1 className="page-title">{t("dashboard.settings", locale)}</h1>
        <p className="page-sub">{org.name}</p>
      </header>

      <section className="card">
        <div className="p-4 space-y-4">
          <div>
            <div className="section-label">{t("settings.organization", locale)}</div>
            {org.subdomain ? <div className="mt-1 text-xs text-text-secondary">Subdomain: {org.subdomain}</div> : null}
          </div>
          <EditOrgForm
            orgSlug={orgSlug}
            initialName={org.name}
            initialSlug={org.slug}
            initialLogoUrl={String((org.settings as { branding?: { logo_url?: string } })?.branding?.logo_url ?? "").trim()}
          />
        </div>
      </section>

      <section className="card">
        <div className="p-4 space-y-4">
          <div className="section-label">{locale === "en" ? "Modules" : "Module"}</div>
          <ModuleToggles
            orgSlug={orgSlug}
            initialFeatures={(org.settings as { features?: Record<string, boolean> })?.features ?? {}}
            currentPlan={String((org as { plan?: string }).plan ?? "free")}
          />
        </div>
      </section>

      <section className="card">
        <div className="p-4 space-y-4">
          <div className="section-label">{locale === "en" ? "Appearance & language" : "Darstellung & Sprache"}</div>
          <AppearanceControls showSectionLabels={false} />
        </div>
      </section>

      <section id="settings-plan" className="card scroll-mt-24">
        <div className="p-4 space-y-4">
          <div className="section-label">{t("settings.plan", locale)}</div>
          {canSeeBilling ? (
            <BillingSection
              orgSlug={orgSlug}
              currentPlan={(org as any).plan ?? "free"}
              enterpriseMailto={enterpriseMailto}
              memberCount={billingMemberCount ?? 0}
            />
          ) : (
            <p className="text-sm text-text-secondary">
              {locale === "de"
                ? "Nur der Inhaber (Owner) kann Abos und Rechnungen verwalten."
                : "Only the organisation owner can manage subscriptions and invoices."}
            </p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="p-4 space-y-4">
          <div className="section-label">{locale === "de" ? "Schicht-Rotation (Fairness)" : "Shift rotation (fairness)"}</div>
          <RotationSettingsForm orgSlug={orgSlug} initial={(org as { rotation_config?: unknown }).rotation_config} />
        </div>
      </section>

      <section className="card">
        <div className="p-4 space-y-3">
          <div className="section-label">{locale === "en" ? "Teams & members" : "Teams & Mitglieder"}</div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/${orgSlug}/admin/committees`} className="btn-secondary">
              {t("settings.manage_teams", locale)}
            </Link>
            <Link href={`/${orgSlug}/admin/members`} className="btn-secondary">
              {t("settings.manage_members", locale)}
            </Link>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="p-4 space-y-4">
          <div className="section-label">{locale === "de" ? "Datenschutz & Daten" : "Privacy & data"}</div>
          <PrivacyActions orgSlug={orgSlug} />
        </div>
      </section>

      <Link href={`/${orgSlug}/admin`} className="btn-secondary inline-flex">
        ← {t("settings.back_to_admin", locale)}
      </Link>
    </div>
  );
}
