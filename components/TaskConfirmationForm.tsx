 "use client";

import { useState } from "react";

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
          ? `${data.message || "Aktualisierung fehlgeschlagen."} (${detail})`
          : data.message || "Aktualisierung fehlgeschlagen."
      );
      return;
    }

    setStatus(nextStatus);
    setMessage(data.message || "Status aktualisiert.");
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
            Deadline:{" "}
            {new Date(task.due_at).toLocaleString("de-DE", {
              dateStyle: "short",
              timeStyle: "short"
            })}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-600">
          Current status:{" "}
          <span className="font-semibold">{status.toUpperCase()}</span>
        </p>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            className="btn-secondary flex-1"
            disabled={loading || status === "in_arbeit"}
            onClick={() => onUpdate("in_arbeit")}
          >
            Set in progress
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={loading || disabledErledigt}
            onClick={() => onUpdate("erledigt")}
          >
            Mark as done
          </button>
        </div>
        {disabledErledigt && (
          <p className="text-[11px] text-red-600">
            Proof is required for this task. Please upload a file first.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">
            Upload proof (PNG / JPG / PDF)
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
            Comment (optional, internal only)
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

