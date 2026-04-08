"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "../../../hooks/useToast";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";
import AdminTaskCard, { type AdminKanbanTask } from "../../../components/tasks/AdminTaskCard";
import { getKanbanColumnForTask, type KanbanColumnKey } from "../../../lib/taskKanbanColumns";

const STATUS_COLUMNS: { key: KanbanColumnKey; labelKey: string }[] = [
  { key: "offen", labelKey: "tasks.status_open" },
  { key: "in_arbeit", labelKey: "tasks.status_in_progress" },
  { key: "erledigt", labelKey: "tasks.status_done" },
  { key: "ueberfaellig", labelKey: "tasks.status_overdue" }
];

const COLUMN_SURFACE: Record<KanbanColumnKey, string> = {
  offen:
    "border-blue-500/25 bg-blue-500/[0.07] shadow-blue-900/5 dark:border-blue-500/35 dark:bg-blue-950/30",
  in_arbeit:
    "border-amber-500/25 bg-amber-500/[0.08] shadow-amber-900/5 dark:border-amber-500/35 dark:bg-amber-950/25",
  erledigt:
    "border-emerald-500/25 bg-emerald-500/[0.07] shadow-emerald-900/5 dark:border-emerald-500/35 dark:bg-emerald-950/25",
  ueberfaellig:
    "border-red-500/30 bg-red-500/[0.06] shadow-red-900/10 dark:border-red-500/40 dark:bg-red-950/30"
};

export default function AdminTasksKanban({
  tasks: serverTasks,
  orgId,
  orgSlug,
  profileNames
}: {
  tasks: AdminKanbanTask[];
  orgId: string | null;
  orgSlug: string | null;
  profileNames: Record<string, string>;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<KanbanColumnKey | null>(null);

  const tasks = serverTasks.map((tk) =>
    statusOverrides[tk.id] ? { ...tk, status: statusOverrides[tk.id] } : tk
  );

  const handleStatusChange = useCallback(
    async (taskId: string, newStatus: string) => {
      const prev = serverTasks.find((tk) => tk.id === taskId)?.status;
      if (prev === newStatus) return;

      const task = serverTasks.find((tk) => tk.id === taskId);
      if (newStatus === "erledigt" && task?.proof_required && !task?.proof_url) {
        toast(t("tasks.proof_required_before_done", locale), "error");
        return;
      }

      setStatusOverrides((o) => ({ ...o, [taskId]: newStatus }));
      setSavingIds((s) => new Set(s).add(taskId));
      setDraggingId(null);
      setDropTarget(null);

      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            errorKey?: string;
          };
          const msg = data.errorKey
            ? t(data.errorKey, locale)
            : data.error || `Server error: ${res.status}`;
          throw new Error(msg);
        }
        setStatusOverrides((o) => {
          const copy = { ...o };
          delete copy[taskId];
          return copy;
        });
        router.refresh();
      } catch (err) {
        console.error("Task status update failed:", err);
        setStatusOverrides((o) => {
          const copy = { ...o };
          delete copy[taskId];
          return copy;
        });
        const msg =
          err instanceof Error && err.message
            ? err.message
            : t("tasks.complete_error", locale);
        toast(msg, "error");
      } finally {
        setSavingIds((s) => {
          const copy = new Set(s);
          copy.delete(taskId);
          return copy;
        });
      }
    },
    [router, serverTasks, locale]
  );

  return (
    <div className="w-full min-w-0">
      {/* 1 col phone, 2 cols tablet, 4 cols from xl — avoids 4 squeezed columns at md */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 xl:gap-5">
      {STATUS_COLUMNS.map((col) => (
        <div
          key={col.key}
          className={`flex min-h-[min(40vh,12rem)] min-w-0 flex-col gap-2 overflow-hidden rounded-[var(--radius-modal)] border p-4 shadow-sm ${COLUMN_SURFACE[col.key]} ${dropTarget === col.key ? "ring-2 ring-[var(--blue-mid)] ring-offset-2 ring-offset-bg-app dark:ring-offset-black/60" : ""}`}
          onDragEnter={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDropTarget(col.key);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDropTarget(col.key);
          }}
          onDragLeave={(e) => {
            const rel = e.relatedTarget;
            if (rel instanceof Node && e.currentTarget.contains(rel)) return;
            setDropTarget((d) => (d === col.key ? null : d));
          }}
          onDrop={(e) => {
            e.preventDefault();
            const taskId = e.dataTransfer.getData("taskId");
            setDropTarget(null);
            if (taskId) void handleStatusChange(taskId, col.key);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t(col.labelKey, locale)}
            </h3>
            <span className="inline-flex min-h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-full bg-bg-primary/80 px-1.5 text-[10px] font-semibold tabular-nums text-text-secondary ring-1 ring-black/5 dark:bg-black/25 dark:text-text-primary dark:ring-white/10">
              {tasks.filter((x) => getKanbanColumnForTask(x) === col.key).length}
            </span>
          </div>
          <div className="min-h-[6rem] min-w-0 flex-1 space-y-2 text-xs">
            {tasks
              .filter((x) => getKanbanColumnForTask(x) === col.key)
              .map((task) => (
                <AdminTaskCard
                  key={task.id}
                  task={task}
                  locale={locale}
                  orgId={orgId}
                  orgSlug={orgSlug}
                  profileNames={profileNames}
                  saving={savingIds.has(task.id)}
                  onStatusChange={handleStatusChange}
                  draggable
                  dragging={draggingId === task.id}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("taskId", task.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(task.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                />
              ))}
            {!tasks.filter((x) => getKanbanColumnForTask(x) === col.key).length && (
              <p className="text-[11px] text-text-muted">{t("tasks.no_tasks_in_column", locale)}</p>
            )}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
