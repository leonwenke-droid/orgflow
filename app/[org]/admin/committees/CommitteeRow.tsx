"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { updateCommitteeAction, deleteCommitteeAction } from "./actions";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";

const MENU_WIDTH_PX = 288; /* w-72 */

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

  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(
      window.innerWidth - MENU_WIDTH_PX - margin,
      Math.max(margin, r.right - MENU_WIDTH_PX)
    );
    const top = r.bottom + margin;
    setMenuPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    updateMenuPosition();
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const t = triggerRef.current;
      const target = e.target as Node;
      if (t?.contains(target)) return;
      const menuEl = document.getElementById(`committee-team-menu-${committee.id}`);
      if (menuEl?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen, committee.id]);

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

  const menuPanel =
    menuOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            id={`committee-team-menu-${committee.id}`}
            role="menu"
            className="fixed z-[200] w-72 rounded-xl border border-border-subtle bg-bg-primary p-3 shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {!editing ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                  className="btn-secondary"
                >
                  {t("common.edit", locale)}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void handleDelete();
                  }}
                  disabled={loading}
                  className="btn-danger"
                >
                  {t("common.delete", locale)}
                </button>
              </div>
            ) : (
              <div className="text-xs text-text-secondary">—</div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="card overflow-visible">
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
                  <span className="tag tag-amber">
                    {committee.openTasks} {locale === "de" ? "Aufgaben offen" : "tasks open"}
                  </span>
                ) : null}
                {typeof committee.upcomingShifts === "number" && committee.upcomingShifts > 0 ? (
                  <span className="tag tag-blue">
                    {committee.upcomingShifts} {locale === "de" ? "Schichten" : "shifts"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              ref={triggerRef}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="cursor-pointer select-none rounded-lg border border-border-subtle px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary"
            >
              ···
            </button>
            {menuPanel}
          </div>
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
