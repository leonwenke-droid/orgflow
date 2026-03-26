"use server";

import { Buffer } from "buffer";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { canViewFinance } from "../../../lib/permissions";
import { parseTreasuryAmount } from "../../../lib/currency";
import { writeAuditLog } from "../../../lib/audit";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { notifyFinanceAudience } from "../../../lib/notifications";

export async function addTreasuryEntryAction(
  organizationId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Not signed in." };

  const orgId = organizationId || null;
  if (!orgId) return { error: "Organization required." };

  const orgSlug = formData.get("org_slug")?.toString()?.trim() || "";

  const service = createSupabaseServiceRoleClient();
  const { data: profileInOrg } = await service
    .from("profiles")
    .select("id, role, organization_id")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgId)
    .maybeSingle();

  const { data: superRows } = !profileInOrg
    ? await service
        .from("profiles")
        .select("id, role, organization_id")
        .eq("auth_user_id", user.id)
        .eq("role", "super_admin")
        .limit(1)
    : { data: null };

  const profile = (profileInOrg ?? (superRows?.[0] ?? null)) as
    | { id: string; role?: string; organization_id?: string | null }
    | null;

  if (!profile || !canViewFinance((profile as { role?: any }).role))
    return { error: "Access only for authorised roles." };

  const date = formData.get("date")?.toString();
  const type = formData.get("type")?.toString() as "income" | "expense" | null;
  let category = formData.get("category")?.toString()?.trim() || null;
  if (category === "__new__") {
    category = formData.get("category_new")?.toString()?.trim() || null;
  }
  const description = formData.get("description")?.toString()?.trim() ?? "";
  const amountRaw = (formData.get("amount") ?? formData.get("amount_cents"))?.toString();
  if (!description) return { error: "Description required." };
  if (!date || !type || (type !== "income" && type !== "expense")) return { error: "Date and type required." };
  const amount = parseTreasuryAmount(String(amountRaw ?? "").trim());
  if (Number.isNaN(amount)) return { error: "Amount must be a valid number." };
  const amountCents = Math.round(amount * 100);
  const amountCentsSigned = type === "expense" ? -Math.abs(amountCents) : Math.abs(amountCents);

  const receipt = formData.get("receipt");
  const receiptFile =
    receipt && typeof receipt === "object" && "size" in receipt && (receipt as File).size > 0
      ? (receipt as File)
      : null;

  const { data: inserted, error } = await service
    .from("treasury_entries")
    .insert({
      organization_id: orgId,
      date,
      description,
      amount_cents: amountCentsSigned,
      type,
      category,
      created_by: (profile as { id: string }).id
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const entryId = inserted?.id as string | undefined;

  if (receiptFile && entryId) {
    try {
      const arrayBuffer = await receiptFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = (receiptFile.name.split(".").pop() || "dat").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "dat";
      const path = `finance-receipts/${orgId}/${entryId}.${ext}`;
      const { error: upErr } = await service.storage.from("task_proofs").upload(path, buffer, {
        contentType: receiptFile.type || "application/octet-stream",
        upsert: true
      });
      if (!upErr) {
        const {
          data: { publicUrl }
        } = service.storage.from("task_proofs").getPublicUrl(path);
        await service.from("treasury_entries").update({ receipt_url: publicUrl }).eq("id", entryId);
      }
    } catch (e) {
      console.error("[treasury entry receipt upload]", e);
    }
  }

  await writeAuditLog({
    organizationId: orgId,
    actorProfileId: (profile as { id: string }).id,
    action: "treasury_entry_created",
    targetTable: "treasury_entries",
    targetId: entryId ?? null,
    metadata: { type, category, amount_cents: amountCentsSigned, date }
  });
  await notifyFinanceAudience(
    service,
    orgId,
    "Kasse / Finanzen",
    `${type === "income" ? "Einnahme" : "Ausgabe"}: ${description || "Neue Buchung"}`,
    ""
  );

  if (orgSlug) revalidatePath(`/${orgSlug}/admin/finanzen`);
  revalidatePath("/admin/treasury");
  return {};
}
