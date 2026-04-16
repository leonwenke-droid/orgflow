import { getRequestLocale } from "../../../../lib/localeServer";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import {
  getCurrentOrganization,
  getOrgIdForData,
  isOrgAdmin,
} from "../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import AdminForbidden from "../AdminForbidden";
import { t } from "../../../../lib/i18n";
import { formatCalendarDateYmd } from "../../../../lib/formatDate";
import ResourcesClient from "./ResourcesClient";

export const dynamic = "force-dynamic";

export default async function AdminMaterialsPage(props: {
  params: Promise<{ org: string }> | { org: string };
  searchParams?: Promise<{ event?: string }> | { event?: string };
}) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });
  const orgSlug = params.org;
  const spRaw = props.searchParams;
  const sp =
    spRaw && typeof (spRaw as Promise<{ event?: string }>).then === "function"
      ? await (spRaw as Promise<{ event?: string }>)
      : ((spRaw as { event?: string } | undefined) ?? {});
  const eventParam = (sp?.event ?? "").trim() || null;
  const org = await getCurrentOrganization(orgSlug);
  const features = (org.settings?.features as Record<string, boolean> | undefined) ?? {};
  const resourcesEnabled = (org as any).plan !== "free" && (features.resources ?? features.materials ?? true) !== false;
  if (!resourcesEnabled) {
    const locale = await getRequestLocale();
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-xl border border-border-subtle bg-bg-primary p-6 shadow-sm dark:border-border-default bg-card">
          <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("resources.title", locale)} />
          <h1 className="mt-3 text-lg font-semibold text-text-primary dark:text-text-primary">
            {locale === "de" ? "Ressourcen sind nicht verfügbar." : "Resources are not available."}
          </h1>
        </div>
      </div>
    );
  }
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData, orgSlug)))
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;

  const locale = await getRequestLocale();
  const service = createSupabaseServiceRoleClient();

  const [{ data: resources }, { data: profiles }, { data: events }] =
    await Promise.all([
      service
        .from("material_procurements")
        .select(
          "id, item_description, size, status, quantity, quantity_unit, category, responsible_user_id, needed_by, source, event_id, event_name, created_at"
        )
        .eq("organization_id", orgIdForData)
        .order("created_at", { ascending: false })
        .limit(500),
      service
        .from("profiles")
        .select("id, full_name")
        .eq("organization_id", orgIdForData),
      service
        .from("events")
        .select("id, name")
        .eq("organization_id", orgIdForData)
        .order("name"),
    ]);

  const nameById: Record<string, string> = Object.fromEntries(
    (profiles ?? []).map((p: any) => [p.id, p.full_name ?? "—"])
  );

  const eventsList = (events ?? []) as { id: string; name: string }[];
  const eventFilter =
    eventParam && eventsList.some((e) => e.id === eventParam)
      ? { id: eventParam, name: eventsList.find((e) => e.id === eventParam)!.name }
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header>
        <AdminBreadcrumb
          orgSlug={orgSlug}
          currentLabel={t("resources.title", locale)}
        />
        <h1 className="page-title">{t("resources.title", locale)}</h1>
        <p className="page-sub">{org.name}</p>
      </header>

      <ResourcesClient
        orgSlug={orgSlug}
        orgId={orgIdForData}
        resources={(resources ?? []) as any}
        nameById={nameById}
        profiles={(profiles ?? []) as any}
        events={eventsList}
        eventFilter={eventFilter}
      />
    </div>
  );
}
