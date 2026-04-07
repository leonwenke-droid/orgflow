/**
 * Maps `profiles.role` (organisation membership) to PDF labels.
 */
export function formatOrgRoleForPdf(
  role: string | null | undefined,
  locale: "de" | "en"
): string {
  const r = String(role ?? "member")
    .trim()
    .toLowerCase();
  if (locale === "de") {
    const m: Record<string, string> = {
      member: "Mitglied",
      admin: "Administrator",
      owner: "Inhaber",
      lead: "Lead",
      teamlead: "Teamleitung",
      team_lead: "Teamleitung",
      super_admin: "Plattform-Admin",
      viewer: "Viewer"
    };
    return m[r] ?? (r ? r.charAt(0).toUpperCase() + r.slice(1) : "—");
  }
  const m: Record<string, string> = {
    member: "Member",
    admin: "Admin",
    owner: "Owner",
    lead: "Lead",
    teamlead: "Team lead",
    team_lead: "Team lead",
    super_admin: "Platform admin",
    viewer: "Viewer"
  };
  return m[r] ?? (r ? r.charAt(0).toUpperCase() + r.slice(1) : "—");
}
