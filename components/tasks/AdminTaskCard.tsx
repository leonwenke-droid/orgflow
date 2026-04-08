"use client";

import Link from "next/link";
import SubmitButtonWithSpinner from "../SubmitButtonWithSpinner";
import type { Locale } from "../../lib/i18n";
import { t } from "../../lib/i18n";
import { formatLocaleDateFromIso } from "../../lib/formatDate";
import { deleteTask } from "../../app/admin/tasks/kanban-actions";

const STATUS_OPTIONS = [
  { value: "offen", labelKey: "tasks.status_open" },
  { value: "in_arbeit", labelKey: "tasks.status_in_progress" },
  { value: "erledigt", labelKey: "tasks.status_done" },
  { value: "ueberfaellig", labelKey: "tasks.status_overdue" }
] as const;

export type AdminKanbanTask = {
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
  committees?: { name?: string } | { name?: string }[] | null;
  events?: { name?: string } | { name?: string }[] | null;
};

function committeeLabel(
  c: AdminKanbanTask["committees"],
  empty: string
): string {
  if (!c) return empty;
  if (Array.isArray(c)) return c[0]?.name ?? empty;
  return c.name ?? empty;
}

function eventLabel(
  e: AdminKanbanTask["events"],
  empty: string
): string {
  if (!e) return empty;
  if (Array.isArray(e)) return e[0]?.name ?? empty;
  return e.name ?? empty;
}

function ownerInitials(fullName: string | undefined, empty: string): string {
  const n = fullName?.trim();
  if (!n) return empty;
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return n.slice(0, 2).toUpperCase();
}

export default function AdminTaskCard({
  task,
  locale,
  orgId,
  orgSlug,
  profileNames,
  saving,
  onStatusChange,
  draggable,
  dragging,
  onDragStart,
  onDragEnd
}: {
  task: AdminKanbanTask;
  locale: Locale;
  orgId: string | null;
  orgSlug: string | null;
  profileNames: Record<string, string>;
  saving: boolean;
  onStatusChange: (taskId: string, newStatus: string) => void;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
}) {
  const empty = t("tasks.empty_value", locale);
  const overdue =
    !!task.due_at &&
    task.status !== "erledigt" &&
    new Date(task.due_at).getTime() < Date.now();

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`min-w-0 max-w-full overflow-hidden rounded-[var(--radius-input)] border bg-bg-secondary p-2 shadow-sm dark:bg-bg-primary/55 ${
        overdue ? "border-red-300 dark:border-red-900/60" : "border-border-subtle dark:border-border-subtle"
      } ${saving ? "animate-pulse" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-primary text-[10px] font-semibold text-text-secondary dark:bg-bg-primary/8"
          aria-hidden
        >
          {ownerInitials(
            task.owner_id ? profileNames[task.owner_id] : undefined,
            empty
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-[11px] font-semibold text-text-primary">{task.title}</h4>
          <p className="text-[10px] text-text-muted">
            {t("tasks.team_label", locale)}: {committeeLabel(task.committees, empty)}
            {eventLabel(task.events, empty) !== empty ? (
              <>
                {" · "}
                {t("tasks.event_label", locale)}: {eventLabel(task.events, empty)}
              </>
            ) : null}
          </p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2 text-[10px]">
        <label className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-text-muted">
            {t("tasks.status_label", locale)}
          </span>
          <select
            value={task.status}
            disabled={saving}
            onChange={(e) => onStatusChange(task.id, e.target.value)}
            className="ui-input max-w-full py-1 text-[10px]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey, locale)}
              </option>
            ))}
          </select>
        </label>
        {task.due_at && (
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${
              overdue
                ? "bg-[var(--red-light)] font-semibold text-[var(--red-dark)] dark:bg-red-950/40 dark:text-red-200"
                : "bg-bg-secondary text-text-secondary dark:bg-bg-primary/8"
            }`}
          >
            {formatLocaleDateFromIso(task.due_at, locale)}
            {overdue ? ` · ${t("tasks.overdue_badge", locale)}` : ""}
          </span>
        )}
      </div>
      <div className="mt-1.5 space-y-0.5 text-[10px] text-text-muted">
        <p>
          {t("tasks.created_by", locale)}:{" "}
          {task.created_by ? profileNames[task.created_by] ?? empty : empty}
        </p>
        <p>
          {t("tasks.assigned_to", locale)}:{" "}
          {task.owner_id ? profileNames[task.owner_id] ?? empty : t("tasks.unassigned", locale)}
        </p>
      </div>
      <p className="mt-1 text-[9px] text-text-muted">
        {task.proof_required
          ? task.proof_url
            ? t("tasks.proof_uploaded", locale)
            : t("tasks.proof_missing", locale)
          : t("tasks.proof_optional", locale)}
      </p>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-[10px] text-text-muted/90">{task.description}</p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px]">
        {orgSlug && (
          <Link
            href={`/${orgSlug}/tasks#task-${task.id}`}
            className="rounded-[var(--radius-pill)] border border-border-subtle bg-bg-primary px-2 py-0.5 text-text-secondary hover:bg-bg-secondary dark:border-border-subtle dark:bg-bg-primary/8 dark:hover:bg-bg-tertiary/80"
          >
            {t("tasks.open_member_view", locale)}
          </Link>
        )}
        {task.proof_url && (
          <>
            <a
              href={task.proof_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[var(--radius-pill)] bg-[var(--blue-light)] px-2 py-0.5 text-[var(--blue-800)] hover:opacity-90 dark:bg-[rgba(24,95,165,.22)] dark:text-[#b5d4f4]"
            >
              {t("tasks.view_proof", locale)}
            </a>
          </>
        )}
      </div>
      <div className="mt-1.5 flex justify-end">
        <form action={deleteTask} className="inline">
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="organization_id" value={orgId ?? ""} />
          <input type="hidden" name="org_slug" value={orgSlug ?? ""} />
          <SubmitButtonWithSpinner
            variant="destructive"
            buttonSize="sm"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px]"
            title={t("tasks.remove_task_title", locale)}
            loadingLabel={t("common.loading", locale)}
          >
            {t("tasks.remove_task", locale)}
          </SubmitButtonWithSpinner>
        </form>
      </div>
    </article>
  );
}
