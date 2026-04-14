import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getStripe } from "../../../../lib/stripe";
import { getPublicBaseUrl } from "../../../../lib/publicBaseUrl";
import { getClientIp, getRequestId, log } from "../../../../lib/log";
import { asTrimmedString, readJson } from "../../../../lib/validation";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { canManageBilling } from "../../../../lib/permissions";

export const runtime = "nodejs";

type Tier = "base" | "scale";

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

    const parsed = await readJson<{ tier?: unknown }>(req);
    const tierRaw = parsed.ok ? asTrimmedString(parsed.data.tier) : "";
    let tier: Tier;
    if (tierRaw === "scale") tier = "scale";
    else if (tierRaw === "base") tier = "base";
    else {
      return NextResponse.json({ message: "Invalid tier. Use base or scale." }, { status: 400 });
    }

    const useScaleTier = tier === "scale";
    const priceIdTeam = process.env.STRIPE_PRICE_TEAM?.trim();
    const priceIdScale = process.env.STRIPE_PRICE_TEAM_SCALE?.trim();
    const priceIdLegacyPro = process.env.STRIPE_PRICE_PRO?.trim();
    const priceId = useScaleTier ? (priceIdScale || priceIdLegacyPro) : (priceIdTeam || priceIdLegacyPro);
    log("info", "stripe_new_org_checkout_env", {
      requestId,
      route: "billing/create-checkout-session-new-org",
      ip,
      tier,
      useScaleTier,
      hasPriceTeam: Boolean(priceIdTeam),
      hasPriceScale: Boolean(priceIdScale),
      hasPriceLegacyPro: Boolean(priceIdLegacyPro),
      hasStripeSecret: Boolean(process.env.STRIPE_SECRET_KEY?.trim())
    });
    if (!priceId) {
      log("warn", "stripe_new_org_checkout_missing_price", {
        requestId,
        route: "billing/create-checkout-session-new-org",
        ip,
        tier,
        useScaleTier
      });
      return NextResponse.json(
        {
          message: useScaleTier
            ? "Stripe price for 50+ members (STRIPE_PRICE_TEAM_SCALE) not configured."
            : "Stripe price (STRIPE_PRICE_TEAM) not configured.",
          code: useScaleTier ? "STRIPE_PRICE_TEAM_SCALE_MISSING" : "STRIPE_PRICE_TEAM_MISSING",
          hint:
            "Set STRIPE_PRICE_TEAM (or STRIPE_PRICE_TEAM_SCALE for 50+). For legacy setups you can also set STRIPE_PRICE_PRO. Also set STRIPE_SECRET_KEY. See .env.example."
        },
        { status: 500 }
      );
    }

    if (!process.env.STRIPE_SECRET_KEY?.trim()) {
      log("warn", "stripe_new_org_checkout_missing_secret", {
        requestId,
        route: "billing/create-checkout-session-new-org",
        ip,
        tier
      });
      return NextResponse.json(
        {
          message: "STRIPE_SECRET_KEY is not configured.",
          code: "STRIPE_SECRET_KEY_MISSING",
          hint: "Add your Stripe secret key to .env.local (see .env.example)."
        },
        { status: 500 }
      );
    }

    // Only allow starting paid org creation from an account that is already an Owner somewhere.
    // (Enforced because billing should be owner-only.)
    const service = createSupabaseServiceRoleClient();
    const { data: ownerProfile } = await service
      .from("profiles")
      .select("id, role")
      .eq("auth_user_id", user.id)
      .in("role", ["owner", "super_admin"])
      .maybeSingle();
    if (!ownerProfile || !canManageBilling((ownerProfile as any).role ?? null)) {
      return NextResponse.json({ message: "Only organisation owners can start billing." }, { status: 403 });
    }

    const stripe = getStripe();
    const baseUrl = await getPublicBaseUrl();
    const successUrl = `${baseUrl}/create-organisation?tier=${tier}&checkout_session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/create-organisation?tier=${tier}&cancelled=1`;
    log("info", "stripe_new_org_checkout_urls", {
      requestId,
      route: "billing/create-checkout-session-new-org",
      ip,
      tier,
      baseUrl
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      metadata: {
        flow: "new_org",
        supabase_user_id: user.id,
        tier
      },
      subscription_data: {
        metadata: {
          flow: "new_org",
          supabase_user_id: user.id,
          tier
        },
        ...(useScaleTier ? {} : { trial_period_days: 14 })
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    log("error", "stripe_checkout_new_org_error", {
      requestId: getRequestId(req),
      route: "billing/create-checkout-session-new-org",
      ip: getClientIp(req),
      error: String(e)
    });
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
