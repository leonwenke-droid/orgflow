import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { getStripe } from "../../../../lib/stripe";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../lib/getOrganization";
import { getPublicBaseUrl } from "../../../../lib/publicBaseUrl";
import { asTrimmedString, readJson } from "../../../../lib/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { user }
  } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const parsed = await readJson<{ orgSlug?: unknown }>(req);
  const orgSlug = parsed.ok ? asTrimmedString(parsed.data.orgSlug) : "";
  if (!orgSlug) return NextResponse.json({ message: "orgSlug required." }, { status: 400 });

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData, orgSlug))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const service = createSupabaseServiceRoleClient();
  const { data: orgRow, error: orgErr } = await service
    .from("organizations")
    .select("id, slug, name, stripe_customer_id")
    .eq("id", org.id)
    .single();
  if (orgErr || !orgRow) return NextResponse.json({ message: "Organisation not found." }, { status: 404 });

  const stripe = getStripe();
  let customerId = (orgRow as { stripe_customer_id?: string | null }).stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: (orgRow as { name?: string | null }).name ?? undefined,
      metadata: { org_id: orgRow.id, org_slug: orgRow.slug }
    });
    customerId = customer.id;
    await service.from("organizations").update({ stripe_customer_id: customerId }).eq("id", orgRow.id);
  }

  const baseUrl = await getPublicBaseUrl();
  const returnUrl = `${baseUrl}/${encodeURIComponent(orgSlug)}/settings`;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl
  });

  return NextResponse.json({ url: session.url });
}

