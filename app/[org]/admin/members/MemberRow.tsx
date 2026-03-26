"use client";

import { useState, useRef, useEffect } from "react";
import { updateMemberNameAction, updateMemberCommitteesAction, updateMemberRoleAction, setMemberAsLeadAction, deleteMemberAction, resendLeadInviteAction, setMemberStatusAction } from "./actions";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";
import { Button } from "../../../../components/ui/Button";

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
  const hasLeadRole = member.role === "lead" || member.role === "admin";
  const effectiveStatus = member.status ?? null;
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(member.full_name ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committeeIds, setCommitteeIds] = useState<Set<string>>(
    new Set(member.committee_ids ?? (member.committee_id ? [member.committee_id] : []))
  );
  const [showCommittees, setShowCommittees] = useState(false);
  const [isLead, setIsLead] = useState(hasLeadRole);
  const [showLeadEmailForm, setShowLeadEmailForm] = useState(false);
  const [leadEmail, setLeadEmail] = useState(member.email ?? "");
  const [currentInvite, setCurrentInvite] = useState<{ inviteUrl: string; whatsappText: string } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  async function handleLeadChange(checked: boolean) {
    setError(null);
    if (checked) {
      setIsLead(true);
      setShowLeadEmailForm(true);
      setLeadEmail(member.email ?? "");
      return;
    }
    setShowLeadEmailForm(false);
    setIsLead(false);
    const { error: err } = await updateMemberRoleAction(orgSlug, member.id, "member");
    if (err) {
      setError(err);
      setIsLead(true);
    } else window.location.reload();
  }

  async function handleSubmitLeadWithEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = leadEmail.trim();
    if (!email) {
      setError("Email is required for team lead.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await setMemberAsLeadAction(orgSlug, member.id, email);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
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
    : role === "admin"
      ? "bg-brand-light text-brand-dark"
      : "bg-success-light text-success-dark";

  const roleTag = invited
    ? "tag tag-amber"
    : role === "admin"
      ? "tag tag-blue"
      : "tag tag-neutral";

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold ${avatarClass}`}>
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-gray-900">{fullName}</div>
            <div className="truncate text-xs text-gray-500">{member.email ?? "—"}</div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <span className={roleTag}>
          {invited ? t("members.filter_invited", locale) : role === "admin" ? "Admin" : t("members.filter_active", locale)}
        </span>
        <div className="mt-1 text-[10px] text-gray-500">
          {effectiveStatus === "disabled"
            ? t("members.status_disabled", locale)
            : invited
              ? inviteStatusLabel
              : t("members.status_active", locale)}
        </div>
      </td>

      <td className="px-4 py-3">
        <span className="text-sm text-gray-700">{committeeNames || "—"}</span>
      </td>

      <td className="px-4 py-3">
        <details className="relative inline-block">
          <summary className="cursor-pointer select-none rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
            ···
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-gray-100 bg-white p-3 shadow-lg">
            <div className="space-y-3">
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
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-xs font-medium text-gray-700">{t("members.invite_pending", locale)}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={handleCopyInviteLink} disabled={loading} className="btn-secondary">
                      {t("members.copy_invite_link", locale)}
                    </button>
                    <button type="button" onClick={handleCopyWhatsAppText} disabled={loading} className="btn-secondary">
                      {t("members.copy_whatsapp_invite", locale)}
                    </button>
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
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
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
            <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {committees.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                    <input type="checkbox" checked={committeeIds.has(c.id)} onChange={() => toggleCommittee(c.id)} className="rounded border-gray-400" />
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
