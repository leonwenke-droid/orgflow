"use client";

import { useState } from "react";
import { updateCommitteeAction, deleteCommitteeAction } from "./actions";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";
import { Button } from "../../../../components/ui/Button";

type Committee = {
  id: string;
  name: string;
  description?: string | null;
  is_active?: boolean | null;
  memberCount?: number;
};

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
  const [description, setDescription] = useState(committee.description ?? "");
  const [isActive, setIsActive] = useState(committee.is_active !== false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (
      name.trim() === committee.name &&
      (description.trim() || "") === (committee.description ?? "").trim() &&
      isActive === (committee.is_active !== false)
    ) {
      setEditing(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await updateCommitteeAction(orgSlug, committee.id, {
      name: name.trim(),
      description: description.trim() || null,
      is_active: isActive
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

  const showInactive = committee.is_active === false;

  return (
    <li className="flex flex-col gap-2 border-b border-gray-100 pb-3 text-sm last:border-0 dark:border-gray-800">
      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={t("teams.description_placeholder", locale)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300"
            />
            {t("teams.active", locale)}
          </label>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-gray-900 dark:text-gray-100">{committee.name}</span>
            {showInactive && (
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                {t("teams.inactive_badge", locale)}
              </span>
            )}
            {typeof committee.memberCount === "number" ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t("teams.member_count", locale).replace("{count}", String(committee.memberCount))}
              </span>
            ) : null}
          </div>
          {committee.description ? (
            <p className="text-xs text-gray-600 dark:text-gray-400">{committee.description}</p>
          ) : null}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1">
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
              onClick={() => {
                setEditing(false);
                setName(committee.name);
                setDescription(committee.description ?? "");
                setIsActive(committee.is_active !== false);
                setError(null);
              }}
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
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={loading} className="text-xs">
              {t("common.delete", locale)}
            </Button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </li>
  );
}
