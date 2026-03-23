 "use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  status: "offen" | "in_arbeit" | "erledigt";
  proof_required: boolean;
  proof_url: string | null;
};

export default function TaskConfirmationForm({
  token,
  task
}: {
  token: string;
  task: Task;
}) {
  const { locale } = useLocale();
  const [status, setStatus] = useState<Task["status"]>(task.status);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onUpdate = async (nextStatus: Task["status"]) => {
    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("token", token);
    formData.append("status", nextStatus);
    formData.append("comment", comment);
    if (file) formData.append("file", file);

    const res = await fetch("/api/tasks/update-by-token", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      const detail = (data as { detail?: string }).detail;
      setMessage(
        detail
          ? `${data.message || t("tasks.complete_error", locale)} (${detail})`
          : data.message || t("tasks.complete_error", locale)
      );
      return;
    }

    setStatus(nextStatus);
    setMessage(data.message || t("tasks.complete_success", locale));
  };

  const disabledErledigt =
    task.proof_required && !file && !task.proof_url && status !== "erledigt";

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="text-base font-semibold">{task.title}</h3>
        {task.description && (
          <p className="mt-1 text-xs text-gray-600">{task.description}</p>
        )}
        {task.due_at && (
          <p className="mt-2 text-[11px] text-gray-600">
            {t("tasks.deadline", locale)}:{" "}
            {new Date(task.due_at).toLocaleString(locale === "de" ? "de-DE" : "en-GB", {
              dateStyle: "short",
              timeStyle: "short"
            })}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-600">
          {t("tasks.current_status", locale)}:{" "}
          <span className="font-semibold">
            {status === "offen"
              ? t("tasks.status_open", locale)
              : status === "in_arbeit"
                ? t("tasks.status_in_progress", locale)
                : t("tasks.status_done", locale)}
          </span>
        </p>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            className="btn-secondary flex-1"
            disabled={loading || status === "in_arbeit"}
            onClick={() => onUpdate("in_arbeit")}
          >
            {t("tasks.set_in_progress", locale)}
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={loading || disabledErledigt}
            onClick={() => onUpdate("erledigt")}
          >
            {t("tasks.mark_done", locale)}
          </button>
        </div>
        {disabledErledigt && (
          <p className="text-[11px] text-red-600">
            {t("tasks.proof_required_before_done", locale)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">
            {t("tasks.proof_upload_hint", locale)}
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded border border-gray-300 bg-white p-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">
            {t("tasks.comment_optional", locale)}
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white p-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      {message && (
        <p className="text-xs text-gray-600">
          {message}
        </p>
      )}
    </div>
  );
}

