"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import CopyTaskLinkButton from "../../../components/CopyTaskLinkButton";
import SubmitButtonWithSpinner from "../../../components/SubmitButtonWithSpinner";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";
import { formatLocaleDateFromIso } from "../../../lib/formatDate";
import { deleteTask, updateTaskKanbanStatus } from "./kanban-actions";

const STATUS_COLUMNS = [
  { key: "offen", labelKey: "tasks.status_open" },
  { key: "in_arbeit", labelKey: "tasks.status_in_progress" },
  { key: "erledigt", labelKey: "tasks.status_done" }
] as const;

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
  committee_id?: string | null;
  owner_id: string | null;
  created_by: string | null;
  proof_required: boolean;
  proof_url: string | null;
  access_token?: string | null;
  /** Supabase may return object or array for nested select */
  committees?: { name?: string } | { name?: string }[] | null;
};

function committeeLabel(c: TaskRow["committees"]): string {
  if (!c) return "–";
  if (Array.isArray(c)) return c[0]?.name ?? "–";
  return c.name ?? "–";
}

export default function AdminTasksKanban({
  tasks,
  orgId,
  orgSlug,
  profileNames
}: {
  tasks: TaskRow[];
  orgId: string | null;
  orgSlug: string | null;
  profileNames: Record<string, string>;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const handleDrop = useCallback(
    async (taskId: string, newStatus: string) => {
      if (!orgId) return;
      const fd = new FormData();
      fd.set("taskId", taskId);
      fd.set("status", newStatus);
      fd.set("organization_id", orgId);
      fd.set("org_slug", orgSlug ?? "");
      await updateTaskKanbanStatus(fd);
      router.refresh();
      setDraggingId(null);
      setDropTarget(null);
    },
    [orgId, orgSlug, router]
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {STATUS_COLUMNS.map((col) => (
        <div
          key={col.key}
          className={`flex min-h-[min(40vh,12rem)] flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors dark:border-gray-700 dark:bg-card-dark ${
            dropTarget === col.key ? "ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900" : ""
          }`}
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
            if (taskId) void handleDrop(taskId, col.key);
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
              {t(col.labelKey, locale)}
            </h3>
            <span className="text-[10px] text-gray-500">
              {t("tasks.count_tasks", locale).replace(
                "{count}",
                String(tasks.filter((x) => x.status === col.key).length)
              )}
            </span>
          </div>
          <div className="min-h-[6rem] flex-1 space-y-2 text-xs">
            {tasks
              .filter((x) => x.status === col.key)
              .map((task) => {
                const overdue =
                  !!task.due_at &&
                  task.status !== "erledigt" &&
                  new Date(task.due_at).getTime() < Date.now();
                return (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("taskId", task.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(task.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`cursor-grab rounded-lg border bg-gray-50 p-2 shadow-sm active:cursor-grabbing dark:bg-gray-900/40 ${
                      overdue ? "border-red-300 dark:border-red-700" : "border-gray-200 dark:border-gray-700"
                    } ${draggingId === task.id ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-[11px] font-semibold">{task.title}</h4>
                        <p className="text-[10px] text-gray-600 dark:text-gray-400">
                          {t("tasks.team_label", locale)}: {committeeLabel(task.committees)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-[9px]">
                        {task.due_at && (
                          <span
                            className={`rounded px-1 py-0.5 ${
                              overdue
                                ? "bg-red-100 font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-100"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            }`}
                          >
                            {formatLocaleDateFromIso(task.due_at, locale)}
                            {overdue ? ` · ${t("tasks.overdue_badge", locale)}` : ""}
                          </span>
                        )}
                        <span className="text-gray-500">
                          {task.proof_required
                            ? task.proof_url
                              ? t("tasks.proof_uploaded", locale)
                              : t("tasks.proof_missing", locale)
                            : t("tasks.proof_optional", locale)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 space-y-0.5 text-[10px] text-gray-600 dark:text-gray-400">
                      <p>
                        {t("tasks.created_by", locale)}:{" "}
                        {task.created_by ? profileNames[task.created_by] ?? "–" : "–"}
                      </p>
                      <p>
                        {t("tasks.assigned_to", locale)}:{" "}
                        {task.owner_id ? profileNames[task.owner_id] ?? "–" : t("tasks.unassigned", locale)}
                      </p>
                    </div>
                    {task.description && (
                      <p className="mt-1 line-clamp-2 text-[10px] text-gray-500 dark:text-gray-400">
                        {task.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px]">
                      {orgSlug && (
                        <Link
                          href={`/${orgSlug}/tasks#task-${task.id}`}
                          className="rounded bg-slate-100 px-2 py-0.5 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                        >
                          {t("tasks.open_member_view", locale)}
                        </Link>
                      )}
                      {(task.access_token || task.proof_url) && (
                        <>
                          {task.access_token ? <CopyTaskLinkButton token={task.access_token} /> : null}
                          {task.proof_url && (
                            <a
                              href={task.proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded bg-blue-100 px-2 py-0.5 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200"
                            >
                              {t("tasks.view_proof", locale)}
                            </a>
                          )}
                        </>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        {t(col.labelKey, locale)}
                      </span>
                      <form action={deleteTask} className="inline">
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="organization_id" value={orgId ?? ""} />
                        <SubmitButtonWithSpinner
                          variant="destructive"
                          buttonSize="sm"
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px]"
                          title={t("tasks.remove_task_title", locale)}
                          loadingLabel="…"
                        >
                          {t("tasks.remove_task", locale)}
                        </SubmitButtonWithSpinner>
                      </form>
                    </div>
                  </article>
                );
              })}
            {!tasks.filter((x) => x.status === col.key).length && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{t("tasks.no_tasks_in_column", locale)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
