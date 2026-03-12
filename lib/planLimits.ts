/**
 * Plan-based feature limits for OrgFlow SaaS
 */

export type Plan = "free" | "team" | "pro";

export const PLAN_LIMITS: Record<Plan, { members: number; teams: number }> = {
  free: { members: 25, teams: 5 },
  team: { members: 50, teams: 10 },
  pro: { members: Infinity, teams: Infinity },
};

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
