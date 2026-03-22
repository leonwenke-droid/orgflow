"use client";

import { useState } from "react";
import { addMemberAction } from "./actions";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";

type Committee = { id: string; name: string };

export default function AddMemberForm({
  orgSlug,
  committees
}: {
  orgSlug: string;
  committees: Committee[];
}) {
  const { locale } = useLocale();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [committeeIds, setCommitteeIds] = useState<Set<string>>(new Set());
  const [asLead, setAsLead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [whatsappText, setWhatsappText] = useState<string | null>(null);

  const toggleCommittee = (id: string) => {
    setCommitteeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = fullName.trim();
    if (!name) {
      setError(t("members.error_name_required", locale));
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    setInviteUrl(null);
    setWhatsappText(null);
    const result = await addMemberAction(orgSlug, name, {
      email: email.trim() || undefined,
      committeeIds: Array.from(committeeIds),
      asLead
    });
    setLoading(false);
    if (result.errorKey) {
      setError(t(result.errorKey, locale));
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setInviteUrl(result.inviteUrl ?? null);
    setWhatsappText(result.whatsappText ?? null);
    setFullName("");
    setEmail("");
    setCommitteeIds(new Set());
    setAsLead(false);
  };

  async function copyText(text: string | null) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("members.add_manual_title", locale)}</h2>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{t("members.add_manual_hint", locale)}</p>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3 text-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("engagement.export_name", locale)}</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("members.placeholder_name", locale)}
            className="w-full rounded border border-gray-300 bg-white p-2 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={asLead}
            onChange={(e) => setAsLead(e.target.checked)}
            className="rounded border-gray-400"
          />
          {t("members.add_as_lead", locale)}
        </label>
        {asLead && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("members.lead_email_label", locale)}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="max@example.com"
              className="w-full rounded border border-gray-300 bg-white p-2 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        )}
        {committees.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">
              {t("members.teams_selected", locale).replace("{count}", String(committeeIds.size))}
            </summary>
            <div className="mt-1 flex flex-wrap gap-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-800">
              {committees.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={committeeIds.has(c.id)} onChange={() => toggleCommittee(c.id)} className="rounded border-gray-400" />
                  {c.name}
                </label>
              ))}
            </div>
          </details>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-green-600">{t("members.add_success", locale)}</p>}
      {inviteUrl && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
          <p className="font-semibold">{t("members.invite_ready", locale)}</p>
          <p className="mt-1 break-all font-mono">{inviteUrl}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => copyText(inviteUrl)} className="rounded bg-blue-600 px-2 py-1 text-[10px] text-white hover:bg-blue-700">
              {t("members.copy_invite_link", locale)}
            </button>
            <button type="button" onClick={() => copyText(whatsappText)} className="rounded border border-blue-300 px-2 py-1 text-[10px] text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-200 dark:hover:bg-blue-900/40">
              {t("members.copy_whatsapp_invite", locale)}
            </button>
          </div>
        </div>
      )}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? t("members.adding", locale) : t("members.add_member_btn", locale)}
        </button>
      </form>
    </div>
  );
}
