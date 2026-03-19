import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { getCurrentUserOrganization } from "../../../../lib/getOrganization";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import NewTaskForm from "./NewTaskForm";
import { t, localeFromCookie, LOCALE_COOKIE_NAME } from "../../../../lib/i18n";

export const dynamic = "force-dynamic";

type CreateTaskState = { errorKey?: string; error?: string } | null;

async function createTask(_prev: CreateTaskState, formData: FormData): Promise<CreateTaskState> {
  "use server";

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) return { errorKey: "tasks.not_logged_in" };
  const service = createSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, role, organization_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || !["admin", "lead"].includes(profile.role)) {
    return { errorKey: "tasks.not_authorized" };
  }

  const title = formData.get("title")?.toString().trim();
  const description = formData.get("description")?.toString().trim() || null;
  const committeeId = formData.get("committee_id")?.toString() || null;
  const ownerId = formData.get("owner_id")?.toString() || null;
  const dueAt = formData.get("due_at")?.toString() || null;
  const proofRequired = formData.get("proof_required") === "on";
  const eventId = formData.get("event_id")?.toString().trim() || null;
  const claimable = formData.get("claimable") === "on";

  if (!title) {
    return { errorKey: "tasks.title_required" };
  }

  if (dueAt && new Date(dueAt).getTime() < Date.now()) {
    return { errorKey: "tasks.deadline_past" };
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  const orgId = (profile as { organization_id?: string | null }).organization_id ?? null;

  const { error } = await service.from("tasks").insert({
    title,
    description,
    committee_id: committeeId || null,
    owner_id: ownerId || null,
    claimable: !ownerId && claimable,
    created_by: profile.id,
    due_at: dueAt ? new Date(dueAt).toISOString() : null,
    proof_required: proofRequired,
    access_token: token,
    ...(eventId ? { event_id: eventId } : {}),
    ...(orgId ? { organization_id: orgId } : {})
  });

  if (error) {
    console.error(error);
    return { errorKey: "tasks.create_error" };
  }

  const org = await getCurrentUserOrganization();
  redirect(org?.slug ? `/admin/tasks?org=${encodeURIComponent(org.slug)}` : "/admin/tasks");
}

type NewTaskPageProps = { searchParams?: Promise<{ org?: string }> | { org?: string } };

export default async function NewTaskPage(props: NewTaskPageProps) {
  const supabase = createServerComponentClient({ cookies });
  const service = createSupabaseServiceRoleClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    const cookieStore = await cookies();
    const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
    return (
      <p className="text-sm text-amber-300 dark:text-amber-200">
        {t("tasks.session_sign_in", locale)} <a href="/" className="underline">{t("common.sign_in", locale)}</a>.
      </p>
    );
  }

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id, role, organization_id")
    .eq("auth_user_id", userId)
    .single();

  let orgId: string | null = (profile as { organization_id?: string | null } | null)?.organization_id ?? null;
  const raw = props.searchParams;
  const searchParams = raw && typeof (raw as Promise<unknown>).then === "function"
    ? await (raw as Promise<{ org?: string }>)
    : (raw ?? {}) as { org?: string };
  let orgSlug = searchParams?.org?.trim() || null;
  if (!orgSlug && orgId) {
    const userOrg = await getCurrentUserOrganization();
    orgSlug = userOrg?.slug ?? null;
  }
  if (orgSlug) {
    try {
      const { getCurrentOrganization, isOrgAdmin, getOrgIdForData } = await import("../../../../lib/getOrganization");
      const org = await getCurrentOrganization(orgSlug);
      const orgIdForData = getOrgIdForData(orgSlug, org.id);
      if (await isOrgAdmin(orgIdForData)) orgId = orgIdForData;
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
    { data: members, error: membersError },
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

  if (!profile || !["admin", "lead"].includes(profile.role)) {
    const cookieStore = await cookies();
    const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
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

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <div className="space-y-4">
      {orgSlug && (
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("tasks.breadcrumb_new", locale)} />
      )}
      <div className="card max-w-xl space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t("tasks.new_task", locale)}
        </h2>
        <NewTaskForm
          action={createTask}
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
