"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import { formatLocaleDateTime } from "../lib/formatDate";
import { Button } from "./ui/Button";

export type TaskCompletePayload = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  status: "offen" | "in_arbeit" | "erledigt";
  proof_required: boolean;
  proof_url: string | null;
};

export default function TaskCompleteModalButton({
  orgSlug,
  task,
  className,
  triggerLabel
}: {
  orgSlug: string;
  task: TaskCompletePayload;
  className?: string;
  /** Override button label (e.g. „Erledigen“ when in progress). */
  triggerLabel?: string;
}) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)} className={className ?? ""}>
        {triggerLabel ?? t("tasks.complete_or_update", locale)}
      </Button>
      {open ? (
        <TaskCompleteDialog
          orgSlug={orgSlug}
          task={task}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function TaskCompleteDialog({
  orgSlug,
  task,
  onClose
}: {
  orgSlug: string;
  task: TaskCompletePayload;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const [status, setStatus] = useState<TaskCompletePayload["status"]>(task.status);
  const [file, setFile] = useState<File | null>(null);
  const [loadingAction, setLoadingAction] = useState<null | "in_arbeit" | "erledigt">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error" | null>(null);
  const busy = loadingAction !== null;

  const submit = async (nextStatus: "in_arbeit" | "erledigt") => {
    setLoadingAction(nextStatus);
    setMessage(null);

    const formData = new FormData();
    formData.append("orgSlug", orgSlug);
    formData.append("taskId", task.id);
    formData.append("status", nextStatus);
    if (file) formData.append("file", file);

    const res = await fetch("/api/tasks/complete", {
      method: "POST",
      body: formData
    });
    const data = (await res.json()) as { message?: string; detail?: string };
    setLoadingAction(null);

    if (!res.ok) {
      setMessageTone("error");
      setMessage(
        data.detail
          ? `${data.message ?? t("tasks.complete_error", locale)} (${data.detail})`
          : data.message ?? t("tasks.complete_error", locale)
      );
      return;
    }

    setStatus(nextStatus);
    setMessageTone("success");
    setMessage(data.message ?? t("tasks.complete_success", locale));
    router.refresh();
    if (nextStatus === "erledigt") {
      onClose();
    }
  };

  const disabledErledigt =
    task.proof_required && !file && !task.proof_url && status !== "erledigt";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-complete-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border-subtle bg-bg-primary p-5 shadow-xl dark:border-border-default bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            id="task-complete-title"
            className="text-lg font-semibold text-text-primary dark:text-text-primary"
          >
            {t("tasks.complete_modal_title", locale)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-text-secondary hover:bg-bg-secondary dark:hover:bg-bg-primary"
          >
            {t("tasks.modal_close", locale)}
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3 dark:border-border-default dark:bg-bg-primary/40">
            <h3 className="text-base font-semibold text-text-primary dark:text-text-primary">
              {task.title}
            </h3>
            {task.description ? (
              <p className="mt-1 text-xs text-text-secondary dark:text-text-muted">
                {task.description}
              </p>
            ) : null}
            {task.due_at ? (
              <p className="mt-2 text-[11px] text-text-secondary dark:text-text-muted">
                {t("tasks.deadline", locale)}:{" "}
                {formatLocaleDateTime(task.due_at, locale)}
              </p>
            ) : null}
            {task.proof_url ? (
              <a
                href={task.proof_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                {t("tasks.view_proof", locale)}
              </a>
            ) : null}
          </div>

          <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-primary p-3 dark:border-border-default dark:bg-bg-primary/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary dark:text-text-muted">
              {t("tasks.current_status", locale)}
            </p>
            <p className="text-xs text-text-secondary dark:text-text-muted">
              {t("tasks.current_status", locale)}:{" "}
              <span className="font-semibold text-text-primary dark:text-text-primary">
                {status === "offen"
                  ? t("tasks.status_open", locale)
                  : status === "in_arbeit"
                    ? t("tasks.status_in_progress", locale)
                    : t("tasks.status_done", locale)}
              </span>
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                className="btn-secondary inline-flex min-h-[2.25rem] flex-1 min-w-[8rem] items-center justify-center gap-1.5"
                disabled={busy || status === "in_arbeit"}
                aria-busy={loadingAction === "in_arbeit"}
                onClick={() => submit("in_arbeit")}
              >
                {loadingAction === "in_arbeit" ? (
                  <>
                    <span
                      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden
                    />
                    {t("common.loading", locale)}
                  </>
                ) : (
                  t("tasks.set_in_progress", locale)
                )}
              </button>
              <button
                type="button"
                className="btn-primary inline-flex min-h-[2.25rem] flex-1 min-w-[8rem] items-center justify-center gap-1.5"
                disabled={busy || disabledErledigt}
                aria-busy={loadingAction === "erledigt"}
                onClick={() => submit("erledigt")}
              >
                {loadingAction === "erledigt" ? (
                  <>
                    <span
                      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden
                    />
                    {t("common.loading", locale)}
                  </>
                ) : (
                  t("tasks.mark_done", locale)
                )}
              </button>
            </div>
            {disabledErledigt ? (
              <p className="text-[11px] text-red-600 dark:text-red-400">
                {t("tasks.proof_required_before_done", locale)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-primary p-3 dark:border-border-default dark:bg-bg-primary/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary dark:text-text-muted">
              {t("tasks.proof_upload_hint", locale)}
            </p>
            <div>
              <input
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded border border-border-default bg-bg-primary p-2 text-xs dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
              />
            </div>
          </div>

          {message ? (
            <p
              className={`rounded px-2 py-1.5 text-xs ${
                messageTone === "error"
                  ? "bg-[var(--bg-danger-subtle)] text-[var(--color-danger-text)]"
                  : "bg-[var(--bg-success-subtle)] text-[var(--color-success-text)]"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
