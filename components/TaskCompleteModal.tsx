"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

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
  className
}: {
  orgSlug: string;
  task: TaskCompletePayload;
  className?: string;
}) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        }
      >
        {t("tasks.complete_or_update", locale)}
      </button>
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (nextStatus: "in_arbeit" | "erledigt") => {
    setLoading(true);
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
    setLoading(false);

    if (!res.ok) {
      setMessage(
        data.detail
          ? `${data.message ?? t("tasks.complete_error", locale)} (${data.detail})`
          : data.message ?? t("tasks.complete_error", locale)
      );
      return;
    }

    setStatus(nextStatus);
    setMessage(data.message ?? t("tasks.complete_success", locale));
    router.refresh();
    if (nextStatus === "erledigt") {
      onClose();
    }
  };

  const disabledErledigt =
    task.proof_required && !file && !task.proof_url && status !== "erledigt";

  const dateLocale = locale === "de" ? "de-DE" : "en-GB";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-complete-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-card-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            id="task-complete-title"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {t("tasks.complete_modal_title", locale)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {t("tasks.modal_close", locale)}
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {task.title}
            </h3>
            {task.description ? (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {task.description}
              </p>
            ) : null}
            {task.due_at ? (
              <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-400">
                {t("tasks.deadline", locale)}:{" "}
                {new Date(task.due_at).toLocaleString(dateLocale, {
                  dateStyle: "short",
                  timeStyle: "short"
                })}
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

          <div className="space-y-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {t("tasks.current_status", locale)}:{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
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
                className="btn-secondary flex-1 min-w-[8rem]"
                disabled={loading || status === "in_arbeit"}
                onClick={() => submit("in_arbeit")}
              >
                {t("tasks.set_in_progress", locale)}
              </button>
              <button
                type="button"
                className="btn-primary flex-1 min-w-[8rem]"
                disabled={loading || disabledErledigt}
                onClick={() => submit("erledigt")}
              >
                {t("tasks.mark_done", locale)}
              </button>
            </div>
            {disabledErledigt ? (
              <p className="text-[11px] text-red-600 dark:text-red-400">
                {t("tasks.proof_required_before_done", locale)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("tasks.proof_upload_hint", locale)}
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded border border-gray-300 bg-white p-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {message ? (
            <p className="text-xs text-gray-600 dark:text-gray-400">{message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
