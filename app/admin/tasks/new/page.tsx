import { cookies } from "next/headers";
import { getRequestLocale } from "../../../../lib/localeServer";
import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { getCurrentUserOrganization, getOrgIdForData, getCurrentOrganization, isOrgAdmin, resolvePlanningConsoleProfile } from "../../../../lib/getOrganization";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import NewTaskForm from "./NewTaskForm";
import { t } from "../../../../lib/i18n";
import { createTask } from "../createTaskAction";

export const dynamic = "force-dynamic";

type NewTaskPageProps = { searchParams?: Promise<{ org?: string }> | { org?: string } };

export default async function NewTaskPage(props: NewTaskPageProps) {
  const supabase = createServerComponentClient({ cookies });
  const service = createSupabaseServiceRoleClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    const locale = await getRequestLocale();
    return (
      <p className="text-sm text-amber-300 dark:text-amber-200">
        {t("tasks.session_sign_in", locale)} <a href="/" className="underline">{t("common.sign_in", locale)}</a>.
      </p>
    );
  }

  const raw = props.searchParams;
  const searchParams =
    raw && typeof (raw as Promise<unknown>).then === "function"
      ? await (raw as Promise<{ org?: string }>)
      : (raw ?? {}) as { org?: string };
  let orgSlug = searchParams?.org?.trim() || null;
  const profile = await resolvePlanningConsoleProfile(userId, orgSlug);
  let orgId: string | null = (profile as { organization_id?: string | null } | null)?.organization_id ?? null;
  if (!orgSlug && orgId) {
    const userOrg = await getCurrentUserOrganization();
    orgSlug = userOrg?.slug ?? null;
  }
  if (orgSlug) {
    try {
      const org = await getCurrentOrganization(orgSlug);
      const orgIdForData = getOrgIdForData(orgSlug, org.id);
      if (await isOrgAdmin(orgIdForData, orgSlug)) orgId = orgIdForData;
    } catch {
      // orgId bleibt aus Profil
    }
  }

  const committeeQuery = service.from("committees").select("id, name").order("name");
  const membersQuery = service.from("profiles").select("id, full_name, committee_id").order("full_name");
  const eventsQuery = orgId
    ? service.from("events").select("id, name").eq("organization_id", orgId).order("name")
    : Promise.resolve({ data: [] as { id: string; name: string }[] });
  if (orgId) {
    committeeQuery.eq("organization_id", orgId);
    membersQuery.eq("organization_id", orgId);
  }

  const [
    { data: committees, error: committeesError },
    { data: members },
    { data: profileCommittees },
    { data: eventsData }
  ] = await Promise.all([
    committeeQuery,
    membersQuery,
    service.from("profile_committees").select("user_id, committee_id"),
    eventsQuery
  ]);
  const eventsList = (eventsData ?? []) as { id: string; name: string }[];

  const userIdToCommitteeIds = new Map<string, string[]>();
  for (const pc of profileCommittees ?? []) {
    const uid = String((pc as { user_id: string }).user_id);
    const cid = String((pc as { committee_id: string }).committee_id);
    if (!userIdToCommitteeIds.has(uid)) userIdToCommitteeIds.set(uid, []);
    userIdToCommitteeIds.get(uid)!.push(cid);
  }

  if (!profile || !["admin", "lead", "super_admin", "owner"].includes((profile as any).role)) {
    const locale = await getRequestLocale();
    return (
      <p className="text-sm text-red-300 dark:text-red-200">
        {t("tasks.access_admin_only", locale)}
      </p>
    );
  }

  if (committeesError) {
    console.error("Komitees laden:", committeesError);
  }
  const committeeList = (committees ?? []).map((c) => ({
    id: String(c.id),
    name: String(c.name ?? "")
  }));

  const locale = await getRequestLocale();

  return (
    <div className="space-y-4">
      {orgSlug && (
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("tasks.breadcrumb_new", locale)} />
      )}
      <div className="max-w-xl space-y-4">
        <h2 className="text-sm font-semibold text-text-secondary dark:text-text-secondary">
          {t("tasks.new_task", locale)}
        </h2>
        <NewTaskForm
          action={createTask}
          organizationId={orgId ?? undefined}
          orgSlug={orgSlug ?? undefined}
          committeeList={committeeList}
          members={(members ?? []).map((m) => ({
            id: String(m.id),
            full_name: String(m.full_name ?? ""),
            committee_id: m.committee_id != null ? String(m.committee_id) : null,
            committee_ids: userIdToCommitteeIds.get(String(m.id)) ?? []
          }))}
          eventsList={eventsList}
        />
      </div>
    </div>
  );
}
