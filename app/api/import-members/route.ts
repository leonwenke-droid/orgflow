import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import * as XLSX from "xlsx";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { randomUUID } from "crypto";
import {
  buildInviteUrl,
  buildWhatsAppInviteText,
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt
} from "../../../lib/memberInvites";
import { sendMemberInvite } from "../../../lib/n8n";
import { getOrgIdForData } from "../../../lib/getOrganization";
import { assertCanManageMembersAndTeams } from "../../../lib/permissionsServer";
import { canAddMember, type Plan } from "../../../lib/planLimits";
import {
  buildMemberListColumnMap,
  findMemberListHeaderRow,
  memberImportCellIsTruthy,
  normalizeMemberImportHeader,
  parseCommaSeparatedList
} from "../../../lib/memberImportExcel";

export const runtime = "nodejs";

const NAME_COL = 0;
const SCORE_COL = 1;
const KOMITEES_COL = 3;
const LEITUNGEN_COL = 4;

type ImportIssue = { row?: number; name?: string; reason: string };

function parseCommitteeList(val: unknown): string[] {
  if (val == null || val === "" || String(val).trim() === "-") return [];
  return String(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeHeader(val: unknown): string {
  return normalizeMemberImportHeader(val);
}

function readRowsFromExcel(buffer: ArrayBuffer): Map<
  string,
  { score: number; primaryCommittee: string | null; allCommittees: string[]; leadsCommittee: boolean }
> {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets["Engagement Overview"] ?? wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("No worksheet found.");
  const data = XLSX.utils.sheet_to_json(sheet as XLSX.WorkSheet, { header: 1 }) as unknown[][];
  const out = new Map<
    string,
    { score: number; primaryCommittee: string | null; allCommittees: string[]; leadsCommittee: boolean }
  >();
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[] | undefined;
    if (!row || row[NAME_COL] == null || String(row[NAME_COL]).trim() === "") continue;
    const name = String(row[NAME_COL]).trim();
    const scoreVal = row[SCORE_COL];
    const num =
      typeof scoreVal === "number" ? scoreVal : parseFloat(String(scoreVal ?? ""));
    const score = Number.isNaN(num) ? 0 : Math.round(num);
    const komitees = parseCommitteeList(row[KOMITEES_COL]);
    const leitungen = parseCommitteeList(row[LEITUNGEN_COL]);
    const allCommittees = [...new Set([...leitungen, ...komitees])];
    const primaryCommittee =
      leitungen.length > 0 ? leitungen[0] : komitees.length > 0 ? komitees[0] : null;
    out.set(name, {
      score,
      primaryCommittee,
      allCommittees,
      leadsCommittee: leitungen.length > 0
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user }
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Not signed in." }, { status: 401 });
    }

    const formData = await req.formData();
    const orgSlug = formData.get("orgSlug")?.toString()?.trim();
    const file = formData.get("file") as File | null;
    if (!orgSlug || !file) {
      return NextResponse.json(
        { message: "orgSlug and file are required." },
        { status: 400 }
      );
    }

    const { data: org, error: orgErr } = await supabaseAuth
      .from("organizations")
      .select("id, name, plan")
      .or(`slug.eq.${orgSlug},subdomain.eq.${orgSlug}`)
      .eq("is_active", true)
      .single();
    if (orgErr || !org) {
      return NextResponse.json({ message: "Organisation not found." }, { status: 404 });
    }
    const orgName = (org as { id: string; name?: string }).name ?? "Organization";
    const rawPlan = (org as { plan?: string | null }).plan;
    const orgPlan: Plan | null =
      rawPlan === "free" || rawPlan === "team" || rawPlan === "pro" ? rawPlan : null;

    const service = createSupabaseServiceRoleClient();
    const orgIdRaw = (org as { id: string }).id;
    const orgId = getOrgIdForData(orgSlug, orgIdRaw);
    const { getPublicBaseUrl } = await import("../../../lib/publicBaseUrl");
    const baseUrl = await getPublicBaseUrl();
    const orgIdsForProfile = [...new Set([orgId, orgIdRaw].map((x) => String(x).trim()))].filter(Boolean);
    const { data: requesterProfile } = await service
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .in("organization_id", orgIdsForProfile.length ? orgIdsForProfile : [orgId])
      .maybeSingle();
    const invitedBy = (requesterProfile as { id: string } | null)?.id ?? null;

    if (!(await assertCanManageMembersAndTeams(orgId, orgIdRaw, orgSlug))) {
      return NextResponse.json(
        { message: "Forbidden", errorKey: "common.unauthorized" },
        { status: 403 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileName = (file.name ?? "").toLowerCase();
    const isCsv = fileName.endsWith(".csv") || String(file.type ?? "").includes("csv");

    let data: unknown[][];
    if (isCsv) {
      const text = new TextDecoder("utf-8").decode(arrayBuffer);
      const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() !== "");
      data = lines.map((line) => {
        const cells: string[] = [];
        let cur = "";
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQ = !inQ;
            continue;
          }
          if (!inQ && ch === ",") {
            cells.push(cur.trim());
            cur = "";
            continue;
          }
          cur += ch;
        }
        cells.push(cur.trim());
        return cells;
      });
    } else {
      const wb = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = wb.Sheets["Members"] ?? wb.Sheets["Mitglieder"] ?? wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("No worksheet found.");
      data = XLSX.utils.sheet_to_json(sheet as XLSX.WorkSheet, { header: 1 }) as unknown[][];
    }
    const memberListHeaderIdx = findMemberListHeaderRow(data);
    const headerRow0 = data[0] ?? [];
    const headers0 = headerRow0.map((h) => normalizeHeader(h));
    const genericModeFirstRow = headers0.some((h) =>
      ["first_name", "vorname", "full_name", "name"].includes(h)
    );
    const nameToRowEngagement =
      memberListHeaderIdx < 0 && !genericModeFirstRow ? readRowsFromExcel(arrayBuffer) : null;
    if (memberListHeaderIdx >= 0) {
      const hdrs = (data[memberListHeaderIdx] as unknown[]).map((h) => normalizeHeader(h));
      if (!buildMemberListColumnMap(hdrs)) {
        return NextResponse.json(
          { message: "Invalid header row: first name and last name (or full name) are required." },
          { status: 400 }
        );
      }
    } else if (genericModeFirstRow && data.length <= 1) {
      return NextResponse.json(
        { message: "No valid rows found in the members file." },
        { status: 400 }
      );
    } else if ((nameToRowEngagement?.size ?? 0) === 0) {
      return NextResponse.json(
        {
          message:
            "No valid rows in the Excel file (OrgFlow member list, or “Engagement Overview” sheet with column A = name)."
        },
        { status: 400 }
      );
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const issues: ImportIssue[] = [];
    const inviteLinks: { fullName: string; email?: string; inviteUrl: string; whatsappText: string }[] = [];

    const { data: existingProfiles } = await service
      .from("profiles")
      .select("id, full_name, email")
      .eq("organization_id", orgId);
    const existingNames = new Set(
      (existingProfiles ?? []).flatMap((p: { full_name: string | null; email?: string | null }) => [
        (p.full_name ?? "").trim(),
        (p.email ?? "").trim().toLowerCase()
      ]).filter(Boolean)
    );

    const { data: committees } = await service
      .from("committees")
      .select("id, name")
      .eq("organization_id", orgId);
    const nameToCommitteeId = new Map(
      (committees ?? []).map((c: { id: string; name: string }) => [c.name, c.id])
    );

    let memberCountForLimit = (existingProfiles ?? []).length;

    if (memberListHeaderIdx >= 0) {
      const hdrs = (data[memberListHeaderIdx] as unknown[]).map((h) => normalizeHeader(h));
      const map = buildMemberListColumnMap(hdrs)!;

      for (let i = memberListHeaderIdx + 1; i < data.length; i++) {
        const row = data[i] ?? [];
        const firstName = String(row[map.firstNameIdx] ?? "").trim();
        const lastName = String(row[map.lastNameIdx] ?? "").trim();
        const fullName = `${firstName} ${lastName}`.trim();
        const email =
          map.emailIdx >= 0 ? String(row[map.emailIdx] ?? "").trim() : "";
        const phone =
          map.phoneIdx >= 0 ? String(row[map.phoneIdx] ?? "").trim() : "";
        const teamsRaw =
          map.teamsIdx >= 0 ? row[map.teamsIdx] : "";
        const teamNames = [...new Set(parseCommaSeparatedList(teamsRaw))];
        const isAdmin = map.adminIdx >= 0 && memberImportCellIsTruthy(row[map.adminIdx]);
        const isTeamLead = map.teamLeadIdx >= 0 && memberImportCellIsTruthy(row[map.teamLeadIdx]);
        let role: "member" | "lead" | "admin" | "owner" | "viewer" = "member";
        let roleFromColumn = false;
        if (map.roleIdx >= 0) {
          const roleRaw = String(row[map.roleIdx] ?? "").trim().toLowerCase();
          if (roleRaw === "admin" || roleRaw === "owner" || roleRaw === "lead" || roleRaw === "viewer") {
            role = roleRaw;
            roleFromColumn = true;
          }
        }
        if (!roleFromColumn) {
          if (isAdmin) role = "admin";
          else if (isTeamLead) role = "lead";
        }

        if (!firstName || !lastName) continue;

        if (existingNames.has(fullName) || (email && existingNames.has(email.toLowerCase()))) {
          skipped++;
          issues.push({ row: i + 1, name: fullName, reason: "Already exists (duplicate name/email)." });
          continue;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          skipped++;
          issues.push({ row: i + 1, name: fullName, reason: "Invalid email format." });
          continue;
        }
        if (!canAddMember(orgPlan, memberCountForLimit)) {
          skipped++;
          issues.push({ row: i + 1, name: fullName, reason: "Plan member limit reached." });
          continue;
        }

        const id = randomUUID();
        const token = generateInviteToken();
        const tokenHash = hashInviteToken(token);
        const expiresAt = inviteExpiresAt();

        const committeeIdsResolved: string[] = [];
        for (const tn of teamNames) {
          if (!nameToCommitteeId.has(tn)) {
            const { data: inserted } = await service
              .from("committees")
              .insert({ name: tn, organization_id: orgId })
              .select("id")
              .single();
            if (inserted) nameToCommitteeId.set(tn, (inserted as { id: string }).id);
          }
          const cid = nameToCommitteeId.get(tn);
          if (cid) committeeIdsResolved.push(cid);
        }
        const primaryCommitteeId = committeeIdsResolved[0] ?? null;

        const { error: profErr } = await service.from("profiles").insert({
          id,
          full_name: fullName,
          role,
          committee_id: primaryCommitteeId,
          organization_id: orgId,
          auth_user_id: null,
          email: email || null,
          phone: phone || null,
          status: "invited",
          invite_status: "pending",
          invited_at: new Date().toISOString(),
          invite_token_hash: tokenHash,
          invite_expires_at: expiresAt.toISOString(),
          invited_by: invitedBy
        });
        if (profErr) {
          failed++;
          issues.push({ row: i + 1, name: fullName, reason: `Insert failed: ${profErr.message}` });
          continue;
        }
        if (committeeIdsResolved.length > 0) {
          await service.from("profile_committees").insert(
            committeeIdsResolved.map((committee_id) => ({ user_id: id, committee_id }))
          );
        }
        existingNames.add(fullName);
        if (email) existingNames.add(email.toLowerCase());
        memberCountForLimit++;
        created++;

        const inviteUrl = buildInviteUrl(baseUrl, token);
        const whatsappText = buildWhatsAppInviteText({
          firstName: fullName.split(" ")[0] || null,
          organizationName: orgName,
          inviteUrl
        });
        inviteLinks.push({ fullName, email: email || undefined, inviteUrl, whatsappText });

        if (email) {
          await sendMemberInvite({
            email,
            inviteUrl,
            organizationName: orgName,
            role: "Member"
          }).catch((err) => console.error("[import-members] n8n invite failed:", err));
        }
      }
    } else if (genericModeFirstRow) {
      const headers = headers0;
      const nameIdx = headers.findIndex((h) => ["full_name", "name"].includes(h));
      const firstNameIdx = headers.findIndex((h) => h === "first_name" || h === "vorname");
      const lastNameIdx = headers.findIndex((h) => h === "last_name" || h === "nachname");
      const emailIdx = headers.findIndex((h) => h === "email" || h === "e_mail");
      const phoneIdx = headers.findIndex((h) => h === "phone" || h === "telefon");
      const roleIdx = headers.findIndex((h) => h === "role" || h === "rolle");
      const teamIdx = headers.findIndex((h) =>
        ["team", "teams", "team_name", "gruppe", "committee"].includes(h)
      );

      for (let i = 1; i < data.length; i++) {
        const row = data[i] ?? [];
        const firstName = String((firstNameIdx >= 0 ? row[firstNameIdx] : "") ?? "").trim();
        const lastName = String((lastNameIdx >= 0 ? row[lastNameIdx] : "") ?? "").trim();
        const fullName =
          String((nameIdx >= 0 ? row[nameIdx] : "") ?? "").trim() ||
          `${firstName} ${lastName}`.trim();
        const email = String((emailIdx >= 0 ? row[emailIdx] : "") ?? "").trim();
        const phone = String((phoneIdx >= 0 ? row[phoneIdx] : "") ?? "").trim();
        const roleRaw = String((roleIdx >= 0 ? row[roleIdx] : "") ?? "").trim().toLowerCase();
        const role = roleRaw === "admin" || roleRaw === "owner" || roleRaw === "lead" || roleRaw === "viewer"
          ? roleRaw
          : "member";
        const teamCell = teamIdx >= 0 ? row[teamIdx] : "";
        const teamNames = [...new Set(parseCommaSeparatedList(teamCell))];

        if (!fullName) {
          skipped++;
          issues.push({ row: i + 1, reason: "Missing name." });
          continue;
        }
        if (existingNames.has(fullName.trim()) || (email && existingNames.has(email.toLowerCase()))) {
          skipped++;
          issues.push({ row: i + 1, name: fullName, reason: "Already exists (duplicate name/email)." });
          continue;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          skipped++;
          issues.push({ row: i + 1, name: fullName, reason: "Invalid email format." });
          continue;
        }
        if (!canAddMember(orgPlan, memberCountForLimit)) {
          skipped++;
          issues.push({ row: i + 1, name: fullName, reason: "Plan member limit reached." });
          continue;
        }
        const id = randomUUID();
        const token = generateInviteToken();
        const tokenHash = hashInviteToken(token);
        const expiresAt = inviteExpiresAt();
        const committeeIdsResolved: string[] = [];
        for (const tn of teamNames) {
          if (!nameToCommitteeId.has(tn)) {
            const { data: inserted } = await service
              .from("committees")
              .insert({ name: tn, organization_id: orgId })
              .select("id")
              .single();
            if (inserted) nameToCommitteeId.set(tn, (inserted as { id: string }).id);
          }
          const cid = nameToCommitteeId.get(tn);
          if (cid) committeeIdsResolved.push(cid);
        }
        const committeeId = committeeIdsResolved[0] ?? null;

        const { error: profErr } = await service.from("profiles").insert({
          id,
          full_name: fullName,
          role,
          committee_id: committeeId,
          organization_id: orgId,
          auth_user_id: null,
          email: email || null,
          phone: phone || null,
          status: "invited",
          invite_status: "pending",
          invited_at: new Date().toISOString(),
          invite_token_hash: tokenHash,
          invite_expires_at: expiresAt.toISOString(),
          invited_by: invitedBy
        });
        if (profErr) {
          failed++;
          issues.push({ row: i + 1, name: fullName, reason: `Insert failed: ${profErr.message}` });
          continue;
        }
        if (committeeIdsResolved.length > 0) {
          await service.from("profile_committees").insert(
            committeeIdsResolved.map((committee_id) => ({ user_id: id, committee_id }))
          );
        }
        existingNames.add(fullName.trim());
        if (email) existingNames.add(email.toLowerCase());
        memberCountForLimit++;
        created++;

        const inviteUrl = buildInviteUrl(baseUrl, token);
        const whatsappText = buildWhatsAppInviteText({
          firstName: fullName.split(" ")[0] || null,
          organizationName: orgName,
          inviteUrl
        });
        inviteLinks.push({ fullName, email: email || undefined, inviteUrl, whatsappText });

        if (email) {
          await sendMemberInvite({
            email,
            inviteUrl,
            organizationName: orgName,
            role: "Member"
          }).catch((err) => console.error("[import-members] n8n invite failed:", err));
        }
      }
    } else {
      const nameToRow = nameToRowEngagement!;
      const committeeNamesFromExcel = new Set<string>();
      for (const row of nameToRow.values()) {
        if (row.primaryCommittee) committeeNamesFromExcel.add(row.primaryCommittee);
        row.allCommittees.forEach((n) => committeeNamesFromExcel.add(n));
      }
      for (const name of committeeNamesFromExcel) {
        if (!nameToCommitteeId.has(name)) {
          const { data: inserted, error: insErr } = await service
            .from("committees")
            .insert({ name, organization_id: orgId })
            .select("id")
            .single();
          if (!insErr && inserted) {
            nameToCommitteeId.set(name, (inserted as { id: string }).id);
          }
        }
      }

      for (const [fullName, row] of nameToRow) {
        if (existingNames.has(fullName)) {
          skipped++;
          issues.push({ name: fullName, reason: "Already exists (duplicate name)." });
          continue;
        }
        if (!canAddMember(orgPlan, memberCountForLimit)) {
          skipped++;
          issues.push({ name: fullName, reason: "Plan member limit reached." });
          continue;
        }
        const id = randomUUID();
        const token = generateInviteToken();
        const tokenHash = hashInviteToken(token);
        const expiresAt = inviteExpiresAt();
        const role = row.leadsCommittee ? "lead" : "member";
        const committeeId = row.primaryCommittee
          ? nameToCommitteeId.get(row.primaryCommittee) ?? null
          : null;

        const { error: profErr } = await service.from("profiles").insert({
          id,
          full_name: fullName,
          role,
          committee_id: committeeId,
          organization_id: orgId,
          auth_user_id: null,
          email: null,
          status: "invited",
          invite_status: "pending",
          invited_at: new Date().toISOString(),
          invite_token_hash: tokenHash,
          invite_expires_at: expiresAt.toISOString(),
          invited_by: invitedBy
        });
        if (profErr) {
          failed++;
          issues.push({ name: fullName, reason: `Insert failed: ${profErr.message}` });
          continue;
        }

        if (row.score > 0) {
          await service.from("engagement_events").insert({
            user_id: id,
            event_type: "score_import",
            points: row.score,
            source_id: null,
            category: "other",
            organization_id: orgId
          });
        }

        const committeeIdsToInsert = [...new Set(
          row.allCommittees.map((n) => nameToCommitteeId.get(n)).filter(Boolean) as string[]
        )];
        if (committeeIdsToInsert.length > 0) {
          await service.from("profile_committees").insert(
            committeeIdsToInsert.map((cid) => ({ user_id: id, committee_id: cid }))
          );
        }
        existingNames.add(fullName);
        memberCountForLimit++;
        created++;

        const inviteUrl = buildInviteUrl(baseUrl, token);
        const whatsappText = buildWhatsAppInviteText({
          firstName: fullName.split(" ")[0] || null,
          organizationName: orgName,
          inviteUrl
        });
        inviteLinks.push({ fullName, inviteUrl, whatsappText });
      }
    }

    return NextResponse.json({
      message: `${created} members imported. ${skipped} skipped. ${failed} failed.`,
      created,
      skipped,
      failed,
      issues: issues.slice(0, 50),
      inviteLinks: inviteLinks.length > 0 ? inviteLinks : undefined
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Import failed." },
      { status: 500 }
    );
  }
}
