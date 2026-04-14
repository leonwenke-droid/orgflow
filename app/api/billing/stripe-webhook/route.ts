import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { getStripe } from "../../../../lib/stripe";
import { planFromStripePriceId } from "../../../../lib/stripePlan";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ message: "Stripe webhook secret not configured." }, { status: 500 });
  }

  const stripe = getStripe();
  const sig = (await headers()).get("stripe-signature");
  if (!sig) return NextResponse.json({ message: "Missing stripe-signature." }, { status: 400 });

  const rawBody = await req.text();
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ message: `Webhook signature verification failed.` }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      if (String(session?.metadata?.flow ?? "").trim() === "new_org") {
        return NextResponse.json({ received: true });
      }
      const orgId = String(session?.metadata?.org_id ?? session?.client_reference_id ?? "").trim();
      const subscriptionId = String(session?.subscription ?? "").trim() || null;
      const customerId = String(session?.customer ?? "").trim() || null;
      if (orgId) {
        await service
          .from("organizations")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            billing_status: "active"
          })
          .eq("id", orgId);
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const sub = event.data.object as any;
      const subscriptionId = String(sub.id ?? "");
      const customerId = String(sub.customer ?? "");
      const status = String(sub.status ?? "");
      const priceId = String(sub.items?.data?.[0]?.price?.id ?? "");
      const plan = planFromStripePriceId(priceId);

      // Prefer metadata org_id, fallback by customer/subscription id lookup
      const orgIdFromMeta = String(sub?.metadata?.org_id ?? "").trim();
      if (orgIdFromMeta) {
        await service
          .from("organizations")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            billing_status: status,
            plan
          })
          .eq("id", orgIdFromMeta);
      } else {
        await service
          .from("organizations")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            billing_status: status,
            plan
          })
          .or(`stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${subscriptionId}`);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as any;
      const subscriptionId = String(sub.id ?? "");
      const customerId = String(sub.customer ?? "");
      const orgIdFromMeta = String(sub?.metadata?.org_id ?? "").trim();

      if (orgIdFromMeta) {
        await service
          .from("organizations")
          .update({
            stripe_subscription_id: null,
            billing_status: "canceled",
            plan: "free"
          })
          .eq("id", orgIdFromMeta);
      } else {
        await service
          .from("organizations")
          .update({
            stripe_subscription_id: null,
            billing_status: "canceled",
            plan: "free"
          })
          .or(`stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${subscriptionId}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[billing/stripe-webhook]", e);
    return NextResponse.json({ message: "Webhook handler failed." }, { status: 500 });
  }
}

