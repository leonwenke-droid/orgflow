/**
 * Plan-based feature limits for OrgFlow SaaS.
 * Starter (free) = 5 members / 1 team.
 * Pro (`team`, z. B. 29 €) = bis 49 Mitglieder.
 * 50+ (`pro`, z. B. 49 €) = eigener Tarif mit höherem (aber begrenztem) Mitgliederlimit.
 */

export type Plan = "free" | "team" | "pro";

export const PLAN_LIMITS: Record<Plan, { members: number; teams: number }> = {
  free: { members: 5, teams: 1 },
  team: { members: 49, teams: 10 },
  // Intentionally finite so paid tiers are enforced server-side.
  pro: { members: 500, teams: Infinity },
};

/** Ab dieser Mitgliederzahl wird beim Checkout der höhere Stripe-Preis (49 €) verwendet. */
export const PAID_TIER_SCALE_MEMBER_THRESHOLD = 50;

export function getPlanLimits(plan: Plan | null | undefined) {
  return PLAN_LIMITS[plan ?? "free"];
}

export function canAddMember(plan: Plan | null | undefined, currentCount: number): boolean {
  const { members } = getPlanLimits(plan);
  return currentCount < members;
}

export function canAddTeam(plan: Plan | null | undefined, currentCount: number): boolean {
  const { teams } = getPlanLimits(plan);
  return currentCount < teams;
}
