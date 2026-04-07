/**
 * Excel/CSV member list templates (OrgFlow_Members / OrgFlow_Mitgliederliste):
 * Header row contains First Name + Last Name (or Vorname + Nachname), Teams, Team Lead, Admin.
 */

export function normalizeMemberImportHeader(val: unknown): string {
  return String(val ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\wäöüß]/g, "");
}

/** True if this row looks like the OrgFlow member list header (EN or DE template). */
export function isMemberListHeaderRow(row: unknown[] | undefined): boolean {
  if (!row || row.length < 2) return false;
  const headers = row.map(normalizeMemberImportHeader);
  const hasEn = headers.includes("first_name") && headers.includes("last_name");
  const hasDe = headers.includes("vorname") && headers.includes("nachname");
  return hasEn || hasDe;
}

/** First row index where Vorname+Nachname or First+Last headers appear (may be below title rows). */
export function findMemberListHeaderRow(data: unknown[][]): number {
  for (let i = 0; i < data.length; i++) {
    const row = data[i] as unknown[] | undefined;
    if (isMemberListHeaderRow(row)) return i;
  }
  return -1;
}

/** Template uses ✓ / x for Team lead and Admin columns. */
export function memberImportCellIsTruthy(val: unknown): boolean {
  if (val === true || val === 1) return true;
  if (val === false || val === 0 || val == null) return false;
  const raw = String(val).trim();
  if (!raw) return false;
  const s = raw.toLowerCase();
  if (["x", "ja", "yes", "y", "true", "1", "✓", "✔", "☑"].includes(s)) return true;
  if (/[\u2713\u2714\u2611]/.test(raw)) return true;
  return false;
}

export function parseCommaSeparatedList(val: unknown): string[] {
  if (val == null || val === "" || String(val).trim() === "-") return [];
  return String(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type MemberListColumnMap = {
  firstNameIdx: number;
  lastNameIdx: number;
  teamsIdx: number;
  teamLeadIdx: number;
  adminIdx: number;
  emailIdx: number;
  phoneIdx: number;
  roleIdx: number;
};

export function buildMemberListColumnMap(headers: string[]): MemberListColumnMap | null {
  const firstNameIdx = headers.findIndex((h) => h === "first_name" || h === "vorname");
  const lastNameIdx = headers.findIndex((h) => h === "last_name" || h === "nachname");
  if (firstNameIdx < 0 || lastNameIdx < 0) return null;

  const teamsIdx = headers.findIndex((h) =>
    ["teams", "team", "team_name", "gruppe", "committee", "komitees"].includes(h)
  );
  const teamLeadIdx = headers.findIndex((h) =>
    ["team_lead", "teamlead", "teamleitung", "lead"].includes(h)
  );
  const adminIdx = headers.findIndex((h) => h === "admin");
  const emailIdx = headers.findIndex((h) => h === "email" || h === "e_mail");
  const phoneIdx = headers.findIndex((h) => h === "phone" || h === "telefon");
  const roleIdx = headers.findIndex((h) => h === "role" || h === "rolle");

  return {
    firstNameIdx,
    lastNameIdx,
    teamsIdx,
    teamLeadIdx,
    adminIdx,
    emailIdx,
    phoneIdx,
    roleIdx
  };
}
