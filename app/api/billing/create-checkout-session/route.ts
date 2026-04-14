import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { getStripe } from "../../../../lib/stripe";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../lib/getOrganization";
import { getPublicBaseUrl } from "../../../../lib/publicBaseUrl";
import { PAID_TIER_SCALE_MEMBER_THRESHOLD } from "../../../../lib/planLimits";
import { getClientIp, getRequestId, log } from "../../../../lib/log";
import { asTrimmedString, readJson } from "../../../../lib/validation";
import { getEffectiveUserRoleForOrg } from "../../../../lib/getOrganization";
import { canManageBilling } from "../../../../lib/permissions";

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
    if (!orgSlug || requestedPlan !== "team") {
      return NextResponse.json(
        {
          message:
            "Only the Pro (team) plan is available for self-service checkout. Enterprise is on request."
        },
        { status: 400 }
      );
    }

    const org = await getCurrentOrganization(orgSlug);
    const orgIdForData = getOrgIdForData(orgSlug, org.id);
    if (!(await isOrgAdmin(orgIdForData, orgSlug))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const role = await getEffectiveUserRoleForOrg(orgSlug, org);
    if (!canManageBilling(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const service = createSupabaseServiceRoleClient();

    const { count: memberCountRaw } = await service
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgIdForData);
    const memberCount = memberCountRaw ?? 0;

    const useScaleTier = memberCount >= PAID_TIER_SCALE_MEMBER_THRESHOLD;
    const priceId = useScaleTier
      ? process.env.STRIPE_PRICE_TEAM_SCALE?.trim()
      : process.env.STRIPE_PRICE_TEAM?.trim();
    if (!priceId) {
      return NextResponse.json(
        {
          message: useScaleTier
            ? "Stripe price for 50+ members (STRIPE_PRICE_TEAM_SCALE) not configured."
            : "Stripe price not configured."
        },
        { status: 500 }
      );
    }

    const planMeta: "team" | "pro" = useScaleTier ? "pro" : "team";

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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: orgRow.id,
      metadata: { org_id: orgRow.id, plan: planMeta },
      subscription_data: {
        metadata: { org_id: orgRow.id, plan: planMeta },
        // Testphase nur für den günstigeren Tarif (unter 50 Mitglieder beim Abschluss).
        ...(useScaleTier ? {} : { trial_period_days: 14 })
      }
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

