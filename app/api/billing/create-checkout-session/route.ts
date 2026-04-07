import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { getStripe } from "../../../../lib/stripe";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../lib/getOrganization";
import { getPublicBaseUrl } from "../../../../lib/publicBaseUrl";
import { getClientIp, getRequestId, log } from "../../../../lib/log";
import { asTrimmedString, readJson } from "../../../../lib/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const cookieStore = await cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user }
    } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

    const parsed = await readJson<{ orgSlug?: unknown; plan?: unknown }>(req);
    const orgSlug = parsed.ok ? asTrimmedString(parsed.data.orgSlug) : "";
    const requestedPlan = (parsed.ok ? asTrimmedString(parsed.data.plan) : "") as "team" | "pro";
    if (!orgSlug || (requestedPlan !== "team" && requestedPlan !== "pro")) {
      return NextResponse.json({ message: "orgSlug and valid plan required." }, { status: 400 });
    }

    const org = await getCurrentOrganization(orgSlug);
    const orgIdForData = getOrgIdForData(orgSlug, org.id);
    if (!(await isOrgAdmin(orgIdForData, orgSlug))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // `team` = landing „Pro“ (z. B. 29 €/mo, bis 50 Mitglieder); `pro` = Enterprise / unbegrenzt
    const priceId =
      requestedPlan === "team" ? process.env.STRIPE_PRICE_TEAM : process.env.STRIPE_PRICE_PRO;
    if (!priceId) {
      return NextResponse.json({ message: "Stripe price not configured." }, { status: 500 });
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
    const successUrl = `${baseUrl}/${encodeURIComponent(orgSlug)}/settings?billing=success`;
    const cancelUrl = `${baseUrl}/${encodeURIComponent(orgSlug)}/settings?billing=cancel`;

    // Landing „Pro“ = `team`: 14 Tage Testphase im Checkout (Stripe).
    const subscriptionData =
      requestedPlan === "team" ? { trial_period_days: 14 } : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: orgRow.id,
      metadata: { org_id: orgRow.id, plan: requestedPlan },
      ...(subscriptionData ? { subscription_data: subscriptionData } : {})
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    log("error", "stripe_checkout_session_error", {
      requestId: getRequestId(req),
      route: "billing/create-checkout-session",
      ip: getClientIp(req),
      error: String(e)
    });
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}

