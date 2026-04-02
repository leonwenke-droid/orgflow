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
  openTasks?: number;
  upcomingShifts?: number;
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
    <div className="card">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-light text-xs font-semibold text-brand-dark">
              {committee.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase())
                .join("") || "—"}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-sm font-medium text-text-primary">{committee.name}</div>
                {showInactive ? <span className="tag tag-neutral">{t("teams.inactive_badge", locale)}</span> : null}
                {typeof committee.memberCount === "number" ? (
                  <span className="text-xs text-text-secondary">
                    {t("teams.member_count", locale).replace("{count}", String(committee.memberCount))}
                  </span>
                ) : null}
              </div>
              {committee.description ? <div className="mt-1 line-clamp-2 text-sm text-text-secondary">{committee.description}</div> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {typeof committee.openTasks === "number" && committee.openTasks > 0 ? (
                  <span className="tag tag-amber">{committee.openTasks} {locale === "de" ? "Aufgaben offen" : "tasks open"}</span>
                ) : null}
                {typeof committee.upcomingShifts === "number" && committee.upcomingShifts > 0 ? (
                  <span className="tag tag-blue">{committee.upcomingShifts} {locale === "de" ? "Schichten" : "shifts"}</span>
                ) : null}
              </div>
            </div>
          </div>

          <details className="relative">
            <summary className="cursor-pointer select-none rounded-lg border border-border-subtle px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary">
              ···
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-border-subtle bg-bg-primary p-3 shadow-lg">
              {!editing ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditing(true)} className="btn-secondary">
                    {t("common.edit", locale)}
                  </button>
                  <button type="button" onClick={handleDelete} disabled={loading} className="btn-danger">
                    {t("common.delete", locale)}
                  </button>
                </div>
              ) : (
                <div className="text-xs text-text-secondary">—</div>
              )}
            </div>
          </details>
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
              autoFocus
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t("teams.description_placeholder", locale)}
              className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-border-default" />
              {t("teams.active", locale)}
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleSave} disabled={loading} className="btn-primary">
                {t("common.save", locale)}
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
                className="btn-secondary"
              >
                {t("common.cancel", locale)}
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-danger-dark">{error}</p> : null}
      </div>
    </div>
  );
}
