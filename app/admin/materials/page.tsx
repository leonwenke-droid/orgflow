import { cookies } from "next/headers";
import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData, getCurrentUserOrganization } from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import { revalidatePath } from "next/cache";
import AddMaterialForm from "../../../components/AddMaterialForm";
import EmptyState from "../../../components/EmptyState";
import DeleteMaterialButton from "../../../components/DeleteMaterialButton";
import ResourceCategoriesForm from "./ResourceCategoriesForm";

export const dynamic = "force-dynamic";

async function addMaterialProcurement(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; errorKey?: string; success?: boolean }> {
  "use server";

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { errorKey: "common.unauthorized" };
  }

  const service = createSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, role, organization_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || !["admin", "lead"].includes(profile.role)) {
    return { errorKey: "materials.error_unauthorized" };
  }

  const userIds = formData.getAll("user_ids").filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  const eventId = formData.get("event_id")?.toString()?.trim() || null;
  let eventName = formData.get("event_name")?.toString()?.trim() || null;
  const description = formData.get("description")?.toString()?.trim();
  const size = formData.get("size")?.toString() as "small" | "medium" | "large" | null;

  if (!userIds.length || (!eventId && !eventName) || !description || !size || !["small", "medium", "large"].includes(size)) {
    return { errorKey: "materials.error_required" };
  }

  const orgId = (profile as { organization_id?: string | null }).organization_id ?? null;

  if (eventId && orgId) {
    const { data: ev } = await service
      .from("events")
      .select("name")
      .eq("id", eventId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (ev && (ev as any).name) {
      eventName = String((ev as any).name).trim() || eventName;
    }
  }
  const profilesQuery = service.from("profiles").select("id");
  if (orgId) profilesQuery.eq("organization_id", orgId);
  const validProfileIds = new Set((await profilesQuery).data?.map((p) => p.id) ?? []);
  const validUserIds = userIds.filter((id) => validProfileIds.has(id));
  if (validUserIds.length === 0) {
    return { error: "No valid persons selected." };
  }

  const { data: material, error: matError } = await service
    .from("material_procurements")
    .insert({
      user_id: null,
      event_id: eventId,
      event_name: eventName,
      item_description: description,
      size
    })
    .select()
    .single();

  if (matError || !material) {
    return { errorKey: "materials.error_save" };
  }

  let points = size === "small" ? 5 : size === "medium" ? 10 : 15;
  if (orgId) {
    const { data: cat } = await service
      .from("resource_categories")
      .select("points")
      .eq("organization_id", orgId)
      .eq("key", size)
      .eq("enabled", true)
      .maybeSingle();
    if (cat && Number((cat as any).points) >= 0) points = Number((cat as any).points);
  }
  const eventType = `material_${size}`;

  const { error: partError } = await service
    .from("material_procurement_participants")
    .insert(validUserIds.map((user_id) => ({ material_id: material.id, user_id })));

  if (partError) {
    return { error: partError.message };
  }

  const { error: evError } = await service
    .from("engagement_events")
    .insert(
      validUserIds.map((user_id) => ({
        user_id,
        event_type: eventType,
        points,
        source_id: material.id
      }))
    );

  if (evError) {
    return { error: evError.message };
  }

  revalidatePath("/admin/materials");
  return { success: true };
}

async function deleteMaterialProcurement(formData: FormData) {
  "use server";
  const materialId = formData.get("materialId")?.toString()?.trim();
  if (!materialId) return;

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return;

  const service = createSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || !["admin", "lead"].includes(profile.role)) return;

  await service.from("engagement_events").delete().eq("source_id", materialId);
  await service.from("material_procurements").delete().eq("id", materialId);
  revalidatePath("/admin/materials");
}

type MaterialsPageProps = { searchParams?: Promise<{ org?: string; event?: string }> | { org?: string; event?: string } };

export default async function MaterialsPage(props: MaterialsPageProps) {
  const raw = props.searchParams;
  const searchParams = raw && typeof (raw as Promise<unknown>).then === "function"
    ? await (raw as Promise<{ org?: string; event?: string }>)
    : (raw ?? {}) as { org?: string; event?: string };
  const orgSlug = searchParams?.org?.trim() || null;
  const eventIdFilter = searchParams?.event?.trim() || null;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    const loginHref = orgSlug ? `/${orgSlug}/login` : "/";
    return (
      <p className="text-sm text-amber-300">
        Session nicht erkannt. Bitte{" "}
        <a href={loginHref} className="underline">erneut einloggen</a>.
      </p>
    );
  }

  const service = createSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, role, organization_id")
    .eq("auth_user_id", userId)
    .single();

  if (!profile || !["admin", "lead", "super_admin"].includes(profile.role)) {
    return (
      <p className="text-sm text-red-300">
        Access only for admins & team leads.
      </p>
    );
  }

  let orgId: string | null = null;
  if (orgSlug) {
    try {
      const org = await getCurrentOrganization(orgSlug);
      const orgIdForData = getOrgIdForData(orgSlug, org.id);
      if (await isOrgAdmin(orgIdForData)) orgId = orgIdForData;
    } catch {
      orgId = null;
    }
  }
  if (!orgId && profile.organization_id) orgId = profile.organization_id;

  let effectiveOrgSlug = orgSlug;
  let resourceCategories: { value: "small" | "medium" | "large"; label: string; points: number; examples?: string }[] | null = null;
  if (orgId) {
    const userOrg = await getCurrentUserOrganization();
    if (!effectiveOrgSlug && userOrg?.slug) effectiveOrgSlug = userOrg.slug;
    const { data: cats } = await service
      .from("resource_categories")
      .select("key, name, points, examples")
      .eq("organization_id", orgId)
      .eq("enabled", true);
    const keyOrder = ["small", "medium", "large"] as const;
    const list = Array.isArray(cats) ? cats : [];
    resourceCategories = keyOrder.map((k) => {
      const c = list.find((x: any) => x.key === k);
      return c
        ? { value: k, label: String(c.name), points: Number(c.points) || (k === "small" ? 5 : k === "medium" ? 10 : 15), examples: c.examples ?? undefined }
        : { value: k, label: k, points: k === "small" ? 5 : k === "medium" ? 10 : 15 };
    });
  }

  const profilesQuery = service.from("profiles").select("id, full_name").order("full_name");
  if (orgId) profilesQuery.eq("organization_id", orgId);

  const eventsQuery = orgId
    ? service.from("events").select("id, name").eq("organization_id", orgId).order("name")
    : Promise.resolve({ data: [] as { id: string; name: string }[] });
  const materialsQuery = service
    .from("material_procurements")
      .select("id, user_id, event_id, event_name, item_description, size, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (eventIdFilter) materialsQuery.eq("event_id", eventIdFilter);

  const [{ data: profiles }, { data: materials }, { data: participants }, { data: events }] = await Promise.all([
    profilesQuery,
    materialsQuery,
    service.from("material_procurement_participants").select("material_id, user_id")
    ,
    eventsQuery
  ]);

  const profileNames = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string }) => [
      p.id,
      p.full_name ?? "(ohne Namen)"
    ])
  );

  const participantsByMaterial = new Map<string, string[]>();
  for (const p of participants ?? []) {
    const m = p as { material_id: string; user_id: string };
    const list = participantsByMaterial.get(m.material_id) ?? [];
    list.push(m.user_id);
    participantsByMaterial.set(m.material_id, list);
  }

  const orgProfileIds = new Set((profiles ?? []).map((p: { id: string }) => p.id));
  const materialsForOrg =
    orgId == null
      ? (materials ?? [])
      : (materials ?? []).filter((m: { id: string; user_id?: string | null }) => {
          const userIds = participantsByMaterial.get(m.id) ?? (m.user_id ? [m.user_id] : []);
          if (userIds.length === 0) return false;
          return userIds.every((uid) => orgProfileIds.has(uid));
        });

  const eventNameById = new Map((events ?? []).map((e: any) => [e.id as string, e.name as string]));

  return (
    <div className="space-y-6">
      {effectiveOrgSlug && (
        <AdminBreadcrumb orgSlug={effectiveOrgSlug} currentLabel="Material" />
      )}
      <section id="record-material" className="card">
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Record new event & resource management
        </h2>
        {orgId && (
          <div className="mb-4">
            <ResourceCategoriesForm
              orgId={orgId}
              initial={(resourceCategories ?? [
                { value: "small", label: "Small", points: 5 },
                { value: "medium", label: "Medium", points: 10 },
                { value: "large", label: "Large", points: 15 }
              ]).map((c: any) => ({ key: c.value, name: c.label, points: c.points }))}
            />
          </div>
        )}
        <AddMaterialForm
          profiles={profiles ?? []}
          addMaterialProcurement={addMaterialProcurement}
          resourceCategories={resourceCategories ?? undefined}
          events={(events ?? []) as { id: string; name: string }[]}
        />
      </section>

      <section className="card overflow-hidden">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">History</h2>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="p-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Date</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Persons</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Event</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Procured</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Size</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Points</th>
                <th className="w-20 p-3 text-left text-xs font-semibold text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {materialsForOrg.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState messageKey="empty.resources" actionHref="#record-material" actionLabelKey="cta.record_material" className="m-4 rounded-xl" />
                  </td>
                </tr>
              ) : (
                materialsForOrg.map((m: {
                  id: string;
                  user_id?: string | null;
                  event_id?: string | null;
                  event_name: string;
                  item_description: string;
                  size: string;
                  created_at: string;
                }) => {
                  let userIds = participantsByMaterial.get(m.id) ?? [];
                  if (userIds.length === 0 && m.user_id) userIds = [m.user_id];
                  const names = userIds.map((uid) => profileNames.get(uid) ?? "?").join(", ");
                  const pointsPerPerson = m.size === "small" ? 5 : m.size === "medium" ? 10 : 15;
                  const totalPoints = userIds.length * pointsPerPerson;
                  return (
                  <tr
                    key={m.id}
                    className="border-b border-gray-100 transition hover:bg-gray-50"
                  >
                    <td className="p-3 text-gray-600">
                      {new Date(m.created_at).toLocaleDateString("de-DE")}
                    </td>
                    <td className="p-3 text-gray-600">
                      {names || "—"}
                    </td>
                    <td className="p-3 text-gray-600">
                      {m.event_id ? (eventNameById.get(m.event_id) ?? m.event_name) : m.event_name}
                    </td>
                    <td className="p-3 text-gray-600">{m.item_description}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                          m.size === "small"
                            ? "bg-green-100 text-green-700"
                            : m.size === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {m.size === "small" ? "Small" : m.size === "medium" ? "Medium" : "Large"}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-gray-700">
                      +{pointsPerPerson} {userIds.length > 1 ? `× ${userIds.length} = +${totalPoints}` : ""}
                    </td>
                    <td className="p-3">
                      <DeleteMaterialButton
                        materialId={m.id}
                        deleteAction={deleteMaterialProcurement}
                      />
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
