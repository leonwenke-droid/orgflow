"use client";

import { useState, useRef, useEffect } from "react";
import { updateMemberNameAction, updateMemberCommitteesAction, updateMemberRoleAction, setMemberAsLeadAction, deleteMemberAction, resendLeadInviteAction } from "./actions";

type Committee = { id: string; name: string };
type Member = {
  id: string;
  full_name: string | null;
  role?: string;
  committee_id?: string | null;
  email?: string | null;
  auth_user_id?: string | null;
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
  currentAuthUserId = null,
  inviteStatus
}: {
  orgSlug: string;
  member: Member;
  committees: Committee[];
  currentAuthUserId?: string | null;
  inviteStatus?: "pending" | "confirmed";
}) {
  const isCurrentUser = !!currentAuthUserId && member.auth_user_id === currentAuthUserId;
  const hasLeadRole = member.role === "lead" || member.role === "admin";
  const effectiveStatus: "pending" | "confirmed" | null =
    hasLeadRole && inviteStatus ? inviteStatus : null;
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
      setError("E-Mail ist für Komiteeleitung erforderlich.");
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
    if (!window.confirm("Mitglied wirklich vollständig löschen?")) return;
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

  async function handleResendInvite() {
    setLoading(true);
    setError(null);
    const { error } = await resendLeadInviteAction(orgSlug, member.id);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    window.alert("Einladungs-Link wurde erneut gesendet.");
  }

  const committeeNames = committeeNamesForIds(Array.from(committeeIds), committees);

  return (
    <tr className="border-b border-cyan-500/10 last:border-0 hover:bg-cyan-500/5">
      <td className="py-2 pr-3">
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-[140px] rounded border border-cyan-500/30 bg-background px-2 py-0.5 text-sm text-cyan-100"
              autoFocus
            />
            <button type="button" onClick={handleSaveName} disabled={loading} className="rounded bg-cyan-600 px-2 py-0.5 text-[10px] text-white hover:bg-cyan-700 disabled:opacity-50">Speichern</button>
            <button type="button" onClick={() => { setEditingName(false); setName(member.full_name ?? ""); setError(null); }} className="rounded border border-cyan-500/40 px-2 py-0.5 text-[10px] text-cyan-400">Abbrechen</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium text-cyan-100">{isCurrentUser ? "Du" : (member.full_name ?? "–")}</span>
            <button type="button" onClick={() => setEditingName(true)} className="text-[10px] text-cyan-500 hover:text-cyan-400">Bearbeiten</button>
          </div>
        )}
      </td>
      <td className="py-2 pr-3">
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setShowCommittees(!showCommittees)}
            className="rounded border border-cyan-500/30 bg-background/50 px-2 py-0.5 text-xs text-cyan-200 hover:bg-cyan-500/10"
          >
            {committeeNames || "–"} ▾
          </button>
          {showCommittees && (
            <div className="absolute left-0 top-full z-10 mt-1 min-w-[180px] rounded-lg border border-cyan-500/30 bg-card py-2 shadow-lg">
              <div className="max-h-48 space-y-1 overflow-y-auto px-2">
                {committees.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 px-2 py-0.5 text-xs text-cyan-100 hover:bg-cyan-500/10">
                    <input type="checkbox" checked={committeeIds.has(c.id)} onChange={() => toggleCommittee(c.id)} className="rounded border-cyan-500/40" />
                    {c.name}
                  </label>
                ))}
              </div>
              <div className="mt-2 border-t border-cyan-500/20 px-2 pt-2">
                <button type="button" onClick={handleCommitteesSave} disabled={loading} className="w-full rounded bg-cyan-600 py-1 text-[10px] text-white hover:bg-cyan-700 disabled:opacity-50">Speichern</button>
              </div>
            </div>
          )}
        </div>
      </td>
      <td className="py-2 pr-3">
        {showLeadEmailForm ? (
          <form onSubmit={handleSubmitLeadWithEmail} className="flex flex-wrap items-center gap-1">
            <input type="email" required value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder="E-Mail" className="min-w-[140px] rounded border border-cyan-500/30 bg-background px-2 py-0.5 text-xs text-cyan-100" />
            <button type="submit" disabled={loading} className="rounded bg-cyan-600 px-2 py-0.5 text-[10px] text-white hover:bg-cyan-700 disabled:opacity-50">Speichern</button>
            <button type="button" onClick={() => { setShowLeadEmailForm(false); setIsLead(false); setError(null); }} className="rounded border border-cyan-500/40 px-2 py-0.5 text-[10px] text-cyan-400">Abbrechen</button>
          </form>
        ) : (
          <label className="flex cursor-pointer items-center gap-1.5 text-cyan-300">
            <input type="checkbox" checked={isLead} onChange={(e) => handleLeadChange(e.target.checked)} className="rounded border-cyan-500/40" />
            <span className="text-xs">Lead</span>
          </label>
        )}
      </td>
      <td className="py-2 pr-3">
        {effectiveStatus && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${effectiveStatus === "confirmed" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
            {effectiveStatus === "confirmed" ? "Angemeldet" : "Ausstehend"}
          </span>
        )}
      </td>
      <td className="py-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <button type="button" onClick={handleDelete} disabled={loading} className="rounded border border-red-500/60 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-500/10 disabled:opacity-50">Entfernen</button>
            {hasLeadRole && effectiveStatus === "pending" && (
              <button type="button" onClick={handleResendInvite} disabled={loading} className="rounded border border-cyan-500/60 px-2 py-0.5 text-[10px] text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50">Einladung erneut</button>
            )}
          </div>
          {error && <span className="text-[10px] text-red-400">{error}</span>}
        </div>
      </td>
    </tr>
  );
}
