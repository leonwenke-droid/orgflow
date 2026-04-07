import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../lib/supabaseServer";
import { getCurrentOrganization, getOrgIdForData } from "../../lib/getOrganization";
import { getRequestLocale } from "../../lib/localeServer";
import { t } from "../../lib/i18n";
import { claimShiftAction } from "../../app/[org]/shifts/actions";
import MemberShiftsClient from "./MemberShiftsClient";

export default async function MemberConsoleShiftsLoader({ orgSlug }: { orgSlug: string | null }) {
  const locale = await getRequestLocale();

  if (!orgSlug) {
    return (
      <p className="text-sm" style={{ color: "var(--sp-text2, var(--sc-text2))" }}>
        {t("shifts.console_member_need_org", locale)}
      </p>
    );
  }

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const authSupabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await authSupabase.auth.getUser();
  if (!user) {
    return (
      <p className="text-sm" style={{ color: "var(--sp-text2, var(--sc-text2))" }}>
        {t("tasks.session_missing", locale)}
      </p>
    );
  }

  const service = createSupabaseServiceRoleClient();
  const { data: mePrimary } = await service
    .from("profiles")
    .select("id, role, full_name")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();

  const { data: meFallback } =
    !mePrimary && orgIdForData !== org.id
      ? await service
          .from("profiles")
          .select("id, role, full_name")
          .eq("auth_user_id", user.id)
          .eq("organization_id", org.id)
          .maybeSingle()
      : { data: null };

  const myProfile = (mePrimary ?? meFallback) as { id?: string; role?: string; full_name?: string } | null;
  const myProfileId = myProfile?.id ?? null;
  const myDisplayName = myProfile?.full_name ?? "";
  const myRole = myProfile?.role ?? null;

  if (!myProfileId) {
    return (
      <p className="text-sm" style={{ color: "var(--sp-text2, var(--sc-text2))" }}>
        {t("dashboard.use_invited_account", locale)}
      </p>
    );
  }

  const canClaim = myRole !== "viewer";
  const effectiveOrgIdForData = mePrimary ? orgIdForData : org.id;

  const { data: shifts } = await service
    .from("shifts")
    .select(
      "id, event_name, date, start_time, end_time, location, required_slots, auto_assign, claimable, assignment_kind, attendance_mode, qr_token, qr_valid_from, qr_valid_until, shift_assignments(id, user_id, replacement_user_id, status, swap_offered)"
    )
    .eq("organization_id", effectiveOrgIdForData)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  const isAssignedToMe = (s: { shift_assignments?: { user_id?: string; replacement_user_id?: string | null }[] }) =>
    (s.shift_assignments ?? []).some(
      (a) => a.user_id === myProfileId || a.replacement_user_id === myProfileId
    );

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingShiftsRaw = (shifts ?? []).filter((s) => !s.date || String(s.date).slice(0, 10) >= todayStr);

  const upcomingShiftsSorted = [...upcomingShiftsRaw].sort((a, b) => {
    const ma = isAssignedToMe(a) ? 0 : 1;
    const mb = isAssignedToMe(b) ? 0 : 1;
    if (ma !== mb) return ma - mb;
    const da = String(a.date ?? "").slice(0, 10);
    const db = String(b.date ?? "").slice(0, 10);
    const c = da.localeCompare(db);
    if (c !== 0) return c;
    return String(a.start_time ?? "").localeCompare(String(b.start_time ?? ""));
  });

  return (
    <div className="sp-member-embed">
      <MemberShiftsClient
        orgSlug={orgSlug}
        locale={locale}
        canClaim={canClaim}
        myProfileId={myProfileId}
        memberDisplayName={myDisplayName}
        organizationId={effectiveOrgIdForData}
        shifts={upcomingShiftsSorted as never[]}
        claimShiftAction={claimShiftAction}
        embeddedInAdminConsole
      />
    </div>
  );
}
