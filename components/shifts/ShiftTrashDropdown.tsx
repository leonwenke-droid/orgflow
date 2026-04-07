"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";
import {
  loadDeletedShifts,
  restoreShiftFromTrash,
  type DeletedShiftRow
} from "../../app/admin/shifts/shift-trash-actions";
import { formatLocaleDateTime } from "../../lib/formatDate";
import { SHIFT_TRASH_RETENTION_DAYS } from "../../lib/shiftTrashConfig";

export default function ShiftTrashDropdown({ orgId }: { orgId: string }) {
  const { locale } = useLocale();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DeletedShiftRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const r = await loadDeletedShifts(orgId);
    setLoading(false);
    if (r.ok) setItems(r.items);
    else setLoadError(r.error === "forbidden" ? "—" : r.error);
  }, [orgId]);

  useEffect(() => {
    if (!open) return;
    void fetchList();
  }, [open, fetchList]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function onRestore(shiftId: string) {
    setPendingId(shiftId);
    try {
      const fd = new FormData();
      fd.set("shiftId", shiftId);
      await restoreShiftFromTrash(fd);
      const r = await loadDeletedShifts(orgId);
      if (r.ok) setItems(r.items);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="btn flex items-center gap-1.5"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        {t("shifts.trash_menu_label", locale)}
        <span className="text-[10px] opacity-80" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-[60] mt-2 w-[min(100vw-2rem,22rem)] rounded-[var(--sp-radius-md)] border border-[var(--sp-border)] bg-[var(--sp-surface)] p-3 shadow-[var(--sp-shadow-lg)]"
        >
          <p className="mb-2 text-[11px] font-semibold" style={{ color: "var(--sp-text)" }}>
            {t("shifts.trash_title", locale)}
          </p>
          <p className="mb-3 text-[10px] leading-snug" style={{ color: "var(--sp-text2)" }}>
            {t("shifts.trash_retention_hint", locale).replace("{days}", String(SHIFT_TRASH_RETENTION_DAYS))}
          </p>
          {loading ? (
            <p className="text-xs" style={{ color: "var(--sp-text2)" }}>
              {t("shifts.trash_loading", locale)}
            </p>
          ) : loadError ? (
            <p className="text-xs text-red-400">{loadError}</p>
          ) : items.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--sp-text2)" }}>
              {t("shifts.trash_empty", locale)}
            </p>
          ) : (
            <ul className="max-h-[min(60vh,320px)] space-y-2 overflow-y-auto">
              {items.map((shift) => (
                <li
                  key={shift.id}
                  className="flex items-center justify-between gap-2 rounded-[var(--sp-radius-sm)] border border-[var(--sp-border)] bg-[var(--sp-bg1)] px-2.5 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium" style={{ color: "var(--sp-text)" }}>
                      {shift.event_name || t("shifts.untitled_shift", locale)}
                    </p>
                    <p style={{ color: "var(--sp-text2)" }}>
                      {shift.date || "—"} {shift.start_time ? String(shift.start_time).slice(0, 5) : ""}
                    </p>
                    <p className="mt-0.5 text-[10px]" style={{ color: "var(--sp-text3)" }}>
                      {shift.deleted_at ? formatLocaleDateTime(shift.deleted_at, locale) : "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn shrink-0 px-2 py-1 text-[11px] disabled:opacity-50"
                    disabled={pendingId === shift.id}
                    onClick={() => void onRestore(shift.id)}
                  >
                    {pendingId === shift.id ? "…" : t("common.restore", locale)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
