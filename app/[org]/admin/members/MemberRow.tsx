"use client";

import { useState, useRef, useEffect } from "react";
import { updateMemberNameAction, updateMemberCommitteesAction, updateMemberRoleAction, setMemberAsLeadAction, deleteMemberAction, resendLeadInviteAction, setMemberStatusAction } from "./actions";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";

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
    if (!window.confirm("Really delete member completely?")) return;
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
      window.alert("Invite link copied.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite link could not be generated.");
    }
  }

  async function handleCopyWhatsAppText() {
    try {
      const invite = currentInvite ?? await ensureInvite();
      if (!invite) return;
      await navigator.clipboard.writeText(invite.whatsappText);
      window.alert("WhatsApp invite copied.");
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

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
      <td className="py-2 pr-3">
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-[140px] rounded border border-gray-300 bg-white px-2 py-0.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              autoFocus
            />
            <button type="button" onClick={handleSaveName} disabled={loading} className="rounded bg-blue-600 px-2 py-0.5 text-[10px] text-white hover:bg-blue-700 disabled:opacity-50">{t("common.save", locale)}</button>
            <button type="button" onClick={() => { setEditingName(false); setName(member.full_name ?? ""); setError(null); }} className="rounded border border-gray-300 px-2 py-0.5 text-[10px] text-gray-600 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">{t("common.cancel", locale)}</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">{isCurrentUser ? "Du" : (member.full_name ?? "–")}</span>
            <button type="button" onClick={() => setEditingName(true)} className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Edit</button>
          </div>
        )}
      </td>
      <td className="py-2 pr-3">
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setShowCommittees(!showCommittees)}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {committeeNames || "–"} ▾
          </button>
          {showCommittees && (
            <div className="absolute left-0 top-full z-10 mt-1 min-w-[180px] rounded-lg border border-gray-200 bg-white py-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">
              <div className="max-h-48 space-y-1 overflow-y-auto px-2">
                {committees.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                    <input type="checkbox" checked={committeeIds.has(c.id)} onChange={() => toggleCommittee(c.id)} className="rounded border-gray-400" />
                    {c.name}
                  </label>
                ))}
              </div>
              <div className="mt-2 border-t border-gray-200 px-2 pt-2 dark:border-gray-600">
                <button type="button" onClick={handleCommitteesSave} disabled={loading} className="w-full rounded bg-blue-600 py-1 text-[10px] text-white hover:bg-blue-700 disabled:opacity-50">{t("common.save", locale)}</button>
              </div>
            </div>
          )}
        </div>
      </td>
      <td className="py-2 pr-3">
        {showLeadEmailForm ? (
          <form onSubmit={handleSubmitLeadWithEmail} className="flex flex-wrap items-center gap-1">
            <input type="email" required value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder="E-Mail" className="min-w-[140px] rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400" />
            <button type="submit" disabled={loading} className="rounded bg-blue-600 px-2 py-0.5 text-[10px] text-white hover:bg-blue-700 disabled:opacity-50">{t("common.save", locale)}</button>
            <button type="button" onClick={() => { setShowLeadEmailForm(false); setIsLead(false); setError(null); }} className="rounded border border-gray-300 px-2 py-0.5 text-[10px] text-gray-600 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">{t("common.cancel", locale)}</button>
          </form>
        ) : (
          <label className="flex cursor-pointer items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={isLead} onChange={(e) => handleLeadChange(e.target.checked)} className="rounded border-gray-400" />
            <span className="text-xs">Lead</span>
          </label>
        )}
      </td>
      <td className="py-2 pr-3">
          {effectiveStatus && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              effectiveStatus === "active"
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : effectiveStatus === "disabled"
                  ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}>
              {effectiveStatus === "active"
                ? t("members.status_active", locale)
                : effectiveStatus === "disabled"
                  ? t("members.status_disabled", locale)
                  : t("members.status_pending", locale)}
            </span>
          )}
      </td>
      <td className="py-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <button type="button" onClick={handleDelete} disabled={loading} className="rounded border border-red-300 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30">{t("common.remove", locale)}</button>
            {(effectiveStatus !== "active") && (
              <>
                <button type="button" onClick={handleCopyInviteLink} disabled={loading} className="rounded border border-blue-300 px-2 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/30">{t("members.copy_invite_link", locale)}</button>
                <button type="button" onClick={handleCopyWhatsAppText} disabled={loading} className="rounded border border-blue-300 px-2 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/30">{t("members.copy_whatsapp_invite", locale)}</button>
              </>
            )}
            <button type="button" onClick={handleToggleDisabled} disabled={loading} className="rounded border border-gray-300 px-2 py-0.5 text-[10px] text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">{effectiveStatus === "disabled" ? t("members.reactivate", locale) : t("members.disable", locale)}</button>
          </div>
          {error && <span className="text-[10px] text-red-600 dark:text-red-400">{error}</span>}
        </div>
      </td>
    </tr>
  );
}
