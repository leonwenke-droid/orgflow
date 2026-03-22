"use server";

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Not signed in." };

  const orgId = organizationId || null;
  if (!orgId) return { error: "Organization required." };

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
  const category = formData.get("category")?.toString()?.trim() || null;
  const description = formData.get("description")?.toString()?.trim() ?? "";
  const amountRaw = (formData.get("amount") ?? formData.get("amount_cents"))?.toString();
  if (!date || !type || (type !== "income" && type !== "expense")) return { error: "Date and type required." };
  const amount = parseTreasuryAmount(String(amountRaw ?? "").trim());
  if (Number.isNaN(amount)) return { error: "Amount must be a valid number." };
  const amountCents = Math.round(amount * 100);
  const amountCentsSigned = type === "expense" ? -Math.abs(amountCents) : Math.abs(amountCents);

  // Use service-role for write to avoid RLS recursion issues in some legacy policy setups.
  const { error } = await service.from("treasury_entries").insert({
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
  await notifyFinanceAudience(
    service,
    orgId,
    "Kasse / Finanzen",
    `${type === "income" ? "Einnahme" : "Ausgabe"}: ${description || "Neue Buchung"}`,
    ""
  );
  revalidatePath("/admin/treasury");
  return {};
}
