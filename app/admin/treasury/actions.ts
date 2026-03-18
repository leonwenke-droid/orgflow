"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { canViewFinance } from "../../../lib/permissions";
import { parseTreasuryAmount } from "../../../lib/currency";
import { writeAuditLog } from "../../../lib/audit";

export async function addTreasuryEntryAction(
  organizationId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("auth_user_id", user.id)
    .single();
  if (!profile || !canViewFinance((profile as { role?: any }).role))
    return { error: "Access only for authorised roles." };

  const orgId = organizationId || (profile as { organization_id?: string }).organization_id;
  if (!orgId) return { error: "Organization required." };

  const date = formData.get("date")?.toString();
  const type = formData.get("type")?.toString() as "income" | "expense" | null;
  const category = formData.get("category")?.toString()?.trim() || null;
  const description = formData.get("description")?.toString()?.trim() ?? "";
  const amountRaw = (formData.get("amount") ?? formData.get("amount_cents"))?.toString();
  if (!date || !type || (type !== "income" && type !== "expense")) return { error: "Date and type required." };
  const amount = parseTreasuryAmount(String(amountRaw ?? "").trim());
  if (Number.isNaN(amount)) return { error: "Amount must be a valid number." };
  const amountCents = Math.round(amount * 100);
  const amountCentsSigned = type === "expense" ? -Math.abs(amountCents) : Math.abs(amountCents);

  const { error } = await supabase.from("treasury_entries").insert({
    organization_id: orgId,
    date,
    description,
    amount_cents: amountCentsSigned,
    type,
    category,
    created_by: (profile as { id: string }).id,
  });

  if (error) return { error: error.message };
  await writeAuditLog({
    organizationId: orgId,
    actorProfileId: (profile as { id: string }).id,
    action: "treasury_entry_created",
    targetTable: "treasury_entries",
    targetId: null,
    metadata: { type, category, amount_cents: amountCentsSigned, date }
  });
  revalidatePath("/admin/treasury");
  return {};
}
