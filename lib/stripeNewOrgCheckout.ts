import type Stripe from "stripe";
import type { Plan } from "./planLimits";
import { getStripe } from "./stripe";
import { planFromStripePriceId } from "./stripePlan";

export type ValidatedNewOrgCheckout = {
  customerId: string;
  subscription: Stripe.Subscription;
  plan: Exclude<Plan, "free">;
};

/**
 * Verifies a Checkout Session from /api/billing/create-checkout-session-new-org:
 * same user, new_org flow, subscription not yet linked to an organisation.
 */
export async function validateNewOrgCheckoutSessionForUser(
  sessionId: string,
  userId: string
): Promise<{ ok: true; data: ValidatedNewOrgCheckout } | { ok: false; message: string }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.status !== "complete") {
    return { ok: false, message: "Checkout is not complete." };
  }
  const uid = String(session.metadata?.supabase_user_id ?? "").trim();
  if (uid !== userId) {
    return { ok: false, message: "This checkout does not belong to your account." };
  }
  if (String(session.metadata?.flow ?? "").trim() !== "new_org") {
    return { ok: false, message: "Invalid checkout." };
  }

  const subRef = session.subscription;
  const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id;
  if (!subscriptionId) {
    return { ok: false, message: "No subscription on checkout session." };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"]
  });

  if (String(subscription.metadata?.org_id ?? "").trim()) {
    return { ok: false, message: "This checkout was already used to create an organisation." };
  }

  const status = subscription.status;
  if (status !== "active" && status !== "trialing") {
    return { ok: false, message: "Subscription is not active." };
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const plan = planFromStripePriceId(priceId);
  if (plan === "free") {
    return { ok: false, message: "Could not determine a valid plan for this subscription." };
  }

  const cust = subscription.customer;
  const customerId = typeof cust === "string" ? cust : cust?.id;
  if (!customerId) {
    return { ok: false, message: "Missing Stripe customer." };
  }

  return { ok: true, data: { customerId, subscription, plan } };
}
