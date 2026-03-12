import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { getCurrentUserOrganization } from "../../../../lib/getOrganization";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import OwnerSelectWithScope from "../../../../components/OwnerSelectWithScope";
import DueDateTimePicker from "../../../../components/DueDateTimePicker";
import SubmitButtonWithSpinner from "../../../../components/SubmitButtonWithSpinner";

export const dynamic = "force-dynamic";

async function createTask(formData: FormData) {
  "use server";

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Nicht eingeloggt");
  const service = createSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, role, organization_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || !["admin", "lead"].includes(profile.role)) {
    throw new Error("Nicht autorisiert");
  }

  const title = formData.get("title")?.toString().trim();
  const description = formData.get("description")?.toString().trim() || null;
  const committeeId = formData.get("committee_id")?.toString() || null;
  const ownerId = formData.get("owner_id")?.toString() || null;
  const dueAt = formData.get("due_at")?.toString() || null;
  const proofRequired = formData.get("proof_required") === "on";

  if (!title) {
    throw new Error("Titel ist erforderlich");
  }

  if (dueAt && new Date(dueAt).getTime() < Date.now()) {
    throw new Error("Die Deadline darf nicht in der Vergangenheit liegen.");
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  const orgId = (profile as { organization_id?: string | null }).organization_id ?? null;

  const { error } = await service.from("tasks").insert({
    title,
    description,
    committee_id: committeeId || null,
    owner_id: ownerId || null,
    created_by: profile.id,
    due_at: dueAt ? new Date(dueAt).toISOString() : null,
    proof_required: proofRequired,
    access_token: token,
    ...(orgId ? { organization_id: orgId } : {})
  });

  if (error) {
    console.error(error);
    throw new Error("Fehler beim Anlegen der Aufgabe");
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
    return (
      <p className="text-sm text-amber-300">
        Session nicht erkannt. Bitte <a href="/" className="underline">einloggen</a> (über dein Jahrgangs-Admin).
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
  if (orgId) {
    committeeQuery.eq("organization_id", orgId);
    membersQuery.eq("organization_id", orgId);
  }

  const [
    { data: committees, error: committeesError },
    { data: members, error: membersError },
    { data: profileCommittees }
  ] = await Promise.all([
    committeeQuery,
    membersQuery,
    service.from("profile_committees").select("user_id, committee_id")
  ]);

  const userIdToCommitteeIds = new Map<string, string[]>();
  for (const pc of profileCommittees ?? []) {
    const uid = String((pc as { user_id: string }).user_id);
    const cid = String((pc as { committee_id: string }).committee_id);
    if (!userIdToCommitteeIds.has(uid)) userIdToCommitteeIds.set(uid, []);
    userIdToCommitteeIds.get(uid)!.push(cid);
  }

  if (!profile || !["admin", "lead"].includes(profile.role)) {
    return (
      <p className="text-sm text-red-300">
        Access only for admins & team leads.
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

  return (
    <div className="space-y-4">
      {orgSlug && (
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Neue Aufgabe" />
      )}
      <div className="card max-w-xl space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">
          New task
        </h2>
      <form action={createTask} className="space-y-3 text-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">
            Titel
          </label>
          <input
            name="title"
            required
            className="w-full rounded border border-gray-300 bg-white p-2 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">
            Beschreibung
          </label>
          <textarea
            name="description"
            rows={3}
            className="w-full rounded border border-gray-300 bg-white p-2 text-xs"
          />
        </div>
        {committeeList.length === 0 && (
          <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Keine Komitees in der Datenbank. Bitte in Supabase unter Tabelle{" "}
            <strong>committees</strong> Einträge anlegen oder die Seed-Migration{" "}
            <code className="text-[10px]">20260210110000_seed_committees.sql</code> ausführen.
          </p>
        )}
        <OwnerSelectWithScope
          committees={committeeList}
          members={(members ?? []).map((m) => ({
            id: String(m.id),
            full_name: String(m.full_name ?? ""),
            committee_id: m.committee_id != null ? String(m.committee_id) : null,
            committee_ids: userIdToCommitteeIds.get(String(m.id)) ?? []
          }))}
          committeeName="Team"
          ownerName="Verantwortliche Person"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              Deadline
            </label>
            <DueDateTimePicker name="due_at" />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                name="proof_required"
                defaultChecked
                className="rounded border-gray-400"
              />
              Beleg verpflichtend
            </label>
          </div>
        </div>
        <div className="pt-2">
          <SubmitButtonWithSpinner
            className="btn-primary text-xs inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
            loadingLabel="Speichern…"
          >
            Aufgabe speichern
          </SubmitButtonWithSpinner>
        </div>
      </form>
      </div>
    </div>
  );
}
