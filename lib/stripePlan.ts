import type { Plan } from "./planLimits";

/** Map Stripe Price ID to OrgFlow plan (matches webhook / checkout logic). */
export function planFromStripePriceId(priceId: string | null | undefined): Plan {
  if (!priceId) return "free";
  const scale = process.env.STRIPE_PRICE_TEAM_SCALE?.trim();
  const team = process.env.STRIPE_PRICE_TEAM?.trim();
  const pro = process.env.STRIPE_PRICE_PRO?.trim();
  if (scale && priceId === scale) return "pro";
  if (pro && priceId === pro) return "pro";
  if (team && priceId === team) return "team";
  return "free";
}
