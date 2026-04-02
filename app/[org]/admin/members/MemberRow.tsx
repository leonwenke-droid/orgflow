"use client";

import { useState, useRef, useEffect } from "react";
import {
  updateMemberNameAction,
  updateMemberCommitteesAction,
  updateMemberRoleAction,
  deleteMemberAction,
  resendLeadInviteAction,
  setMemberStatusAction,
  type AssignableOrgRole
} from "./actions";
import { useLocale } from "../../../../components/LocaleProvider";
import { t, type Locale } from "../../../../lib/i18n";

type Committee = { id: string; name: string };
type Member = {
  id: string;
  full_name: string | null;
  role?: string;
  committee_id?: string | null;
  email?: string | null;
  auth_user_id?: string | null;
  status?: "invited" | "active" | "disabled" | null;
  invite_status?: "pending" | "accepted" | "expired" | "revoked" | null;
  invite_expires_at?: string | null;
  committee?: { name?: string } | null;
  committee_ids?: string[];
};

function committeeNamesForIds(ids: string[], committees: Committee[]): string {
  const byId = new Map(committees.map((c) => [c.id, c.name]));
  return ids.map((id) => byId.get(id) ?? "").filter(Boolean).join(", ");
}

const ASSIGNABLE_ROLES: AssignableOrgRole[] = ["member", "lead", "admin", "owner", "finance", "viewer"];

function memberRoleLabel(role: string, locale: Locale): string {
  const r = role || "member";
  const keys: Record<string, string> = {
    member: "members.role_member",
    lead: "members.role_lead",
    admin: "members.role_admin",
    owner: "members.role_owner",
    finance: "members.role_finance",
    viewer: "members.role_viewer",
    super_admin: "members.role_super_readonly"
  };
  const key = keys[r];
  return key ? t(key, locale) : r;
}

export default function MemberRow({
  orgSlug,
  member,
  committees,
  currentAuthUserId = null
}: {
  orgSlug: string;
  member: Member;
  committees: Committee[];
  currentAuthUserId?: string | null;
}) {
  const { locale } = useLocale();
  const isCurrentUser = !!currentAuthUserId && member.auth_user_id === currentAuthUserId;
  const effectiveStatus = member.status ?? null;
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(member.full_name ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committeeIds, setCommitteeIds] = useState<Set<string>>(
    new Set(member.committee_ids ?? (member.committee_id ? [member.committee_id] : []))
  );
  const [showCommittees, setShowCommittees] = useState(false);
  const [selectRole, setSelectRole] = useState(String(member.role ?? "member"));
  const [leadEmailDraft, setLeadEmailDraft] = useState(member.email ?? "");
  const [pendingLeadEmail, setPendingLeadEmail] = useState(false);
  const [currentInvite, setCurrentInvite] = useState<{ inviteUrl: string; whatsappText: string } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectRole(String(member.role ?? "member"));
    setLeadEmailDraft(member.email ?? "");
  }, [member.role, member.email]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowCommittees(false);
      }
    }
    if (showCommittees) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCommittees]);

  async function handleSaveName() {
    if ((name || "").trim() === (member.full_name ?? "").trim()) {
      setEditingName(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await updateMemberNameAction(orgSlug, member.id, name.trim());
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setEditingName(false);
    window.location.reload();
  }

  function toggleCommittee(id: string) {
    setCommitteeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCommitteesSave() {
    setError(null);
    const { error: err } = await updateMemberCommitteesAction(
      orgSlug,
      member.id,
      Array.from(committeeIds)
    );
    if (err) setError(err);
    else {
      setShowCommittees(false);
      window.location.reload();
    }
  }

  async function applyRoleChange(next: AssignableOrgRole) {
    setError(null);
    const emailForLead = (leadEmailDraft || member.email || "").trim();
    if (next === "lead" && !emailForLead) {
      setPendingLeadEmail(true);
      setError(t("members.lead_email_required", locale));
      return;
    }
    setLoading(true);
    const { error: err, errorKey } = await updateMemberRoleAction(orgSlug, member.id, next, {
      leadEmail: next === "lead" ? emailForLead : undefined
    });
    setLoading(false);
    if (err || errorKey) {
      setError(err || (errorKey ? t(errorKey, locale) : ""));
      setSelectRole(String(member.role ?? "member"));
      return;
    }
    setPendingLeadEmail(false);
    window.location.reload();
  }

  async function handleDelete() {
    if (!window.confirm(t("members.confirm_delete", locale))) return;
    setLoading(true);
    setError(null);
    const { error } = await deleteMemberAction(orgSlug, member.id);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    window.location.reload();
  }

  async function ensureInvite() {
    setLoading(true);
    setError(null);
    const { error, inviteUrl, whatsappText } = await resendLeadInviteAction(orgSlug, member.id);
    setLoading(false);
    if (error || !inviteUrl || !whatsappText) {
      throw new Error(error || "Invite link could not be generated.");
    }
    const invite = { inviteUrl, whatsappText };
    setCurrentInvite(invite);
    return invite;
  }

  async function handleCopyInviteLink() {
    try {
      const invite = currentInvite ?? await ensureInvite();
      if (!invite) return;
      await navigator.clipboard.writeText(invite.inviteUrl);
      window.alert(t("members.invite_link_copied", locale));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite link could not be generated.");
    }
  }

  async function handleCopyWhatsAppText() {
    try {
      const invite = currentInvite ?? await ensureInvite();
      if (!invite) return;
      await navigator.clipboard.writeText(invite.whatsappText);
      window.alert(t("members.whatsapp_copied", locale));
    } catch (err) {
      setError(err instanceof Error ? err.message : "WhatsApp text could not be generated.");
    }
  }

  async function handleToggleDisabled() {
    setLoading(true);
    setError(null);
    const nextStatus = effectiveStatus === "disabled" ? "active" : "disabled";
    const { error } = await setMemberStatusAction(orgSlug, member.id, nextStatus);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    window.location.reload();
  }

  const committeeNames = committeeNamesForIds(Array.from(committeeIds), committees);
  const inviteStatusLabel =
    member.invite_status === "accepted"
      ? t("members.invite_accepted", locale)
      : member.invite_status === "expired"
        ? t("members.invite_expired", locale)
        : member.invite_status === "revoked"
          ? t("members.invite_revoked", locale)
          : t("members.invite_pending", locale);

  const invited = effectiveStatus === "invited" || member.invite_status === "pending";
  const role = String(member.role ?? "member");

  const fullName = (isCurrentUser ? "Du" : (member.full_name ?? "–")) as string;
  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "—";

  const avatarClass = invited
    ? "bg-warning-light text-warning-dark"
    : role === "admin" || role === "owner"
      ? "bg-brand-light text-brand-dark"
      : role === "lead"
        ? "bg-success-light text-success-dark"
        : "bg-bg-secondary text-text-secondary";

  const roleTag = invited
    ? "tag tag-amber"
    : role === "admin" || role === "owner"
      ? "tag tag-blue"
      : role === "lead"
        ? "tag tag-green"
        : role === "finance"
          ? "tag tag-amber"
          : "tag tag-neutral";

  return (
    <tr className="border-b border-border-subtle last:border-0 hover:bg-bg-secondary">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold ${avatarClass}`}>
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-text-primary">{fullName}</div>
            <div className="truncate text-xs text-text-secondary">{member.email ?? "—"}</div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <span className={roleTag}>
          {invited ? t("members.filter_invited", locale) : memberRoleLabel(role, locale)}
        </span>
        <div className="mt-1 text-[10px] text-text-secondary">
          {effectiveStatus === "disabled"
            ? t("members.status_disabled", locale)
            : invited
              ? inviteStatusLabel
              : t("members.status_active", locale)}
        </div>
      </td>

      <td className="px-4 py-3">
        <span className="text-sm text-text-secondary">{committeeNames || "—"}</span>
      </td>

      <td className="px-4 py-3">
        <details className="relative inline-block">
          <summary className="cursor-pointer select-none rounded-lg border border-border-subtle px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary">
            ···
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-border-subtle bg-bg-primary p-3 shadow-lg">
            <div className="space-y-3">
              {role !== "super_admin" ? (
                <div className="border-b border-border-subtle pb-3">
                  <div className="text-xs font-medium text-text-secondary">{t("members.role_label", locale)}</div>
                  <p className="mt-1 text-[10px] leading-snug text-text-secondary">{t("members.role_hint", locale)}</p>
                  <select
                    className="mt-2 w-full rounded-lg border border-border-subtle bg-bg-primary px-2 py-1.5 text-xs text-text-primary"
                    value={selectRole}
                    disabled={loading}
                    onChange={async (e) => {
                      const v = e.target.value as AssignableOrgRole;
                      setPendingLeadEmail(false);
                      setSelectRole(v);
                      if (v === "lead" && !(member.email?.trim()) && !leadEmailDraft.trim()) {
                        setPendingLeadEmail(true);
                        setSelectRole(String(member.role ?? "member"));
                        return;
                      }
                      await applyRoleChange(v);
                    }}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {memberRoleLabel(r, locale)}
                      </option>
                    ))}
                  </select>
                  {pendingLeadEmail ? (
                    <div className="mt-2 space-y-2">
                      <input
                        type="email"
                        value={leadEmailDraft}
                        onChange={(ev) => setLeadEmailDraft(ev.target.value)}
                        placeholder={t("members.lead_email_label", locale)}
                        className="w-full rounded-lg border border-border-subtle bg-bg-primary px-2 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        disabled={loading}
                        className="btn-primary text-xs"
                        onClick={() => applyRoleChange("lead")}
                      >
                        {t("common.save", locale)}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="border-b border-border-subtle pb-3 text-xs text-text-secondary">
                  {memberRoleLabel(role, locale)}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditingName(true)} className="btn-secondary">
                  {t("common.edit", locale)}
                </button>
                <button type="button" onClick={() => setShowCommittees(true)} className="btn-secondary">
                  {t("dashboard.teams", locale)}
                </button>
                <button type="button" onClick={handleToggleDisabled} disabled={loading} className="btn-secondary">
                  {effectiveStatus === "disabled" ? t("members.reactivate", locale) : t("members.disable", locale)}
                </button>
                <button type="button" onClick={handleDelete} disabled={loading} className="btn-danger">
                  {t("common.remove", locale)}
                </button>
              </div>

              {(effectiveStatus !== "active") && (
                <div className="border-t border-border-subtle pt-3">
                  <div className="text-xs font-medium text-text-secondary">{t("members.invite_pending", locale)}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={handleCopyInviteLink} disabled={loading} className="btn-secondary">
                      {t("members.copy_invite_link", locale)}
                    </button>
                    <button type="button" onClick={handleCopyWhatsAppText} disabled={loading} className="btn-secondary">
                      {t("members.copy_whatsapp_invite", locale)}
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      className="btn-secondary"
                      onClick={async () => {
                        const invite = currentInvite ?? await ensureInvite();
                        if (!invite) return;
                        window.open(
                          `https://wa.me/?text=${encodeURIComponent(invite.whatsappText)}`,
                          "_blank"
                        );
                      }}
                    >
                      WhatsApp
                    </button>
                    {typeof navigator !== "undefined" && "share" in navigator && (
                      <button
                        type="button"
                        disabled={loading}
                        className="btn-secondary"
                        onClick={async () => {
                          const invite = currentInvite ?? await ensureInvite();
                          if (!invite) return;
                          try {
                            await navigator.share({
                              title: "OrgFlow Invite",
                              text: invite.whatsappText,
                              url: invite.inviteUrl,
                            });
                          } catch {}
                        }}
                      >
                        {locale === "de" ? "Teilen" : "Share"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {error ? <div className="text-xs text-danger">{error}</div> : null}
            </div>
          </div>
        </details>

        {editingName ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
              autoFocus
            />
            <button type="button" onClick={handleSaveName} disabled={loading} className="btn-primary">
              {t("common.save", locale)}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingName(false);
                setName(member.full_name ?? "");
                setError(null);
              }}
              className="btn-secondary"
            >
              {t("common.cancel", locale)}
            </button>
          </div>
        ) : null}

        {showCommittees ? (
          <div className="relative mt-2" ref={popoverRef}>
            <div className="rounded-xl border border-border-subtle bg-bg-primary p-3 shadow-sm">
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {committees.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary">
                    <input type="checkbox" checked={committeeIds.has(c.id)} onChange={() => toggleCommittee(c.id)} className="rounded border-border-default" />
                    {c.name}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={handleCommitteesSave} disabled={loading} className="btn-primary">
                  {t("common.save", locale)}
                </button>
                <button type="button" onClick={() => setShowCommittees(false)} className="btn-secondary">
                  {t("common.cancel", locale)}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </td>
    </tr>
  );
}
