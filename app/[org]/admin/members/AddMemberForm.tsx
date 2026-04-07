"use client";

import { useState } from "react";
import { addMemberAction } from "./actions";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";
import { copyTextToClipboard } from "../../../../lib/clipboard";

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
    await copyTextToClipboard(text);
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-primary p-4 shadow-sm dark:border-border-default bg-card">
      <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">{t("members.add_manual_title", locale)}</h2>
      <p className="mt-1 text-xs text-text-secondary dark:text-text-muted">{t("members.add_manual_hint", locale)}</p>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3 text-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary dark:text-text-secondary">{t("engagement.export_name", locale)}</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("members.placeholder_name", locale)}
            className="w-full rounded border border-border-default bg-bg-primary p-2 text-xs text-text-primary dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary dark:text-text-muted">
          <input
            type="checkbox"
            checked={asLead}
            onChange={(e) => setAsLead(e.target.checked)}
            className="rounded border-border-default"
          />
          {t("members.add_as_lead", locale)}
        </label>
        {asLead && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-secondary dark:text-text-secondary">{t("members.lead_email_label", locale)}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="max@example.com"
              className="w-full rounded border border-border-default bg-bg-primary p-2 text-xs text-text-primary dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
            />
          </div>
        )}
        {committees.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-text-secondary hover:text-text-primary dark:text-text-secondary dark:hover:text-text-primary">
              {t("members.teams_selected", locale).replace("{count}", String(committeeIds.size))}
            </summary>
            <div className="mt-1 flex flex-wrap gap-2 rounded border border-border-subtle bg-bg-secondary p-2 dark:border-border-default dark:bg-bg-primary">
              {committees.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary dark:text-text-secondary">
                  <input type="checkbox" checked={committeeIds.has(c.id)} onChange={() => toggleCommittee(c.id)} className="rounded border-border-default" />
                  {c.name}
                </label>
              ))}
            </div>
          </details>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-green-600">{t("members.add_success", locale)}</p>}
      {inviteUrl && (
        <div className="rounded border border-[var(--color-brand)]/25 bg-[var(--bg-brand-subtle)] p-3 text-xs text-[var(--color-brand-text)]">
          <p className="font-semibold">{t("members.invite_ready", locale)}</p>
          <p className="mt-1 break-all font-mono">{inviteUrl}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => copyText(inviteUrl)} className="rounded bg-blue-600 px-2 py-1 text-[10px] text-white hover:bg-blue-700">
              {t("members.copy_invite_link", locale)}
            </button>
            <button type="button" onClick={() => copyText(whatsappText)} className="rounded border border-[var(--color-brand)]/40 px-2 py-1 text-[10px] text-[var(--color-brand-text)] hover:bg-[var(--bg-brand-subtle)]">
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
