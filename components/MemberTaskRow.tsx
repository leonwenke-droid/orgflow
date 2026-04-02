"use client";

import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { formatLocaleDateTime } from "../lib/formatDate";
import { formatTaskStatus } from "../lib/formatters";
import type { AppLocale as FormatterLocale } from "../lib/formatters";
import { taskRowBorderClass } from "../lib/taskStatus";
import { StatusBadge } from "./ui/StatusBadge";
import SubmitButtonWithSpinner from "./SubmitButtonWithSpinner";
import TaskCompleteModalButton from "./TaskCompleteModal";
import type { TaskCompletePayload } from "./TaskCompleteModal";

export type MemberTaskRowTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
  owner_id: string | null;
  claimable: boolean;
  proof_required: boolean;
  proof_url: string | null;
  committees?: { name?: string | null } | { name?: string | null }[] | null;
  /** When true, a transfer request is pending admin approval for this task. */
  transferPending?: boolean;
};

type Props = {
  task: MemberTaskRowTask;
  locale: Locale;
  orgSlug: string;
  myProfileId: string | null;
  nameById: Record<string, string>;
  canClaim: boolean;
  claimTaskAction: (formData: FormData) => Promise<void>;
  offerTaskAction: (formData: FormData) => Promise<void>;
  /** Erledigte Aufgaben: reduzierte Aktionen */
  isCompleted?: boolean;
};

export default function MemberTaskRow({
  task,
  locale,
  orgSlug,
  myProfileId,
  nameById,
  canClaim,
  claimTaskAction,
  offerTaskAction,
  isCompleted = false
}: Props) {
  const fl = locale as FormatterLocale;
  const ownedByMe = !!myProfileId && task.owner_id === myProfileId;
  const claimableHere =
    task.owner_id == null &&
    task.claimable === true &&
    (task.status === "offen" || task.status === "in_arbeit");

  const dueTs = task.due_at ? new Date(task.due_at).getTime() : NaN;
  const overdue =
    !Number.isNaN(dueTs) &&
    dueTs < Date.now() &&
    task.status !== "erledigt" &&
    task.status !== "abgebrochen";

  const borderClass = taskRowBorderClass(task.status, task.due_at);
  const c = task.committees;
  const teamName =
    (Array.isArray(c) ? c[0]?.name : c?.name) ?? "–";

  const ownerLabel = () => {
    if (!task.owner_id) return null;
    if (ownedByMe) return t("tasks.claimed_by_self", locale);
    return `${t("tasks.claimed_by", locale)}: ${nameById[task.owner_id] ?? "–"}`;
  };

  const payload: TaskCompletePayload = {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    due_at: task.due_at ?? null,
    status:
      task.status === "offen" || task.status === "in_arbeit" || task.status === "erledigt"
        ? task.status
        : "offen",
    proof_required: !!task.proof_required,
    proof_url: task.proof_url ?? null
  };

  const primaryLabel =
    task.status === "in_arbeit" ? t("tasks.primary_complete", locale) : t("tasks.complete_or_update", locale);

  return (
    <li
      id={`task-${task.id}`}
      className={`scroll-mt-24 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] pl-0 dark:border-white/10 dark:bg-[#161614] ${borderClass} ${
        isCompleted || task.status === "erledigt" ? "opacity-90" : ""
      }`}
    >
      <div className="flex gap-3 px-3 py-3">
        <div className="shrink-0 pt-0.5">
          <StatusBadge status={task.status} locale={fl} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 flex-1 font-medium text-text-primary">{task.title}</p>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {!isCompleted && claimableHere && canClaim ? (
                <form action={claimTaskAction} className="inline">
                  <input type="hidden" name="orgSlug" value={orgSlug} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <SubmitButtonWithSpinner
                    variant="primary"
                    buttonSize="sm"
                    loadingLabel={t("common.loading", locale)}
                  >
                    {t("tasks.claim", locale)}
                  </SubmitButtonWithSpinner>
                </form>
              ) : null}
              {!isCompleted && ownedByMe ? (
                <TaskCompleteModalButton orgSlug={orgSlug} task={payload} triggerLabel={primaryLabel} />
              ) : null}
            </div>
          </div>
          <p
            className={`mt-1 text-xs ${
              overdue && task.status !== "erledigt" ? "text-[var(--red)] dark:text-red-200" : "text-text-muted"
            }`}
          >
            <span className="font-medium text-text-secondary">{t("tasks.due_label", locale)}:</span>{" "}
            {task.due_at ? formatLocaleDateTime(task.due_at, locale) : "–"}
            {" · "}
            {formatTaskStatus(task.status, fl)}
            {teamName !== "–" ? ` · ${teamName}` : ""}
            {ownerLabel() ? ` · ${ownerLabel()}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {task.transferPending ? (
              <span className="tag tag-amber">{t("transfers.badge_pending", locale)}</span>
            ) : !isCompleted && ownedByMe && canClaim ? (
              <form action={offerTaskAction} className="inline">
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="taskId" value={task.id} />
                <SubmitButtonWithSpinner
                  variant="secondary"
                  buttonSize="sm"
                  loadingLabel={t("common.loading", locale)}
                >
                  {t("tasks.offer_short", locale)}
                </SubmitButtonWithSpinner>
              </form>
            ) : null}
            {task.proof_url ? (
              <a
                className="text-xs text-[var(--blue-600)] hover:underline dark:text-[var(--blue-400)]"
                href={task.proof_url}
                target="_blank"
                rel="noreferrer"
              >
                {t("tasks.view_proof", locale)}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
