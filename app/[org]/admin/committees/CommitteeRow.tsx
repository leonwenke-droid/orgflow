"use client";

import { useState } from "react";
import { updateCommitteeNameAction, deleteCommitteeAction } from "./actions";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";

type Committee = { id: string; name: string };

export default function CommitteeRow({
  orgSlug,
  committee
}: {
  orgSlug: string;
  committee: Committee;
}) {
  const { locale } = useLocale();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(committee.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (name.trim() === committee.name) {
      setEditing(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await updateCommitteeNameAction(orgSlug, committee.id, name.trim());
    setLoading(false);
    if (result.errorKey) {
      setError(t(result.errorKey, locale));
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    window.location.reload();
  }

  async function handleDelete() {
    if (!confirm(t("members.delete_team_confirm", locale).replace("{name}", committee.name))) return;
    setLoading(true);
    setError(null);
    const result = await deleteCommitteeAction(orgSlug, committee.id);
    setLoading(false);
    if (result.errorKey) {
      setError(t(result.errorKey, locale));
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    window.location.reload();
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      {editing ? (
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          autoFocus
        />
      ) : (
        <span className="text-gray-900 dark:text-gray-100">{committee.name}</span>
      )}
      <div className="flex items-center gap-1">
        {editing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "…" : t("common.save", locale)}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setName(committee.name); setError(null); }}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t("common.cancel", locale)}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t("common.edit", locale)}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              {t("common.delete", locale)}
            </button>
          </>
        )}
      </div>
      {error && <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>}
    </li>
  );
}
