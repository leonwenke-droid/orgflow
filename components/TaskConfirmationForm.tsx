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
          <p className="mt-1 text-xs text-cyan-100/80">{task.description}</p>
        )}
        {task.due_at && (
          <p className="mt-2 text-[11px] text-cyan-400/80">
            Deadline:{" "}
            {new Date(task.due_at).toLocaleString("de-DE", {
              dateStyle: "short",
              timeStyle: "short"
            })}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-cyan-400/80">
          Aktueller Status:{" "}
          <span className="font-semibold">{status.toUpperCase()}</span>
        </p>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            className="btn-secondary flex-1"
            disabled={loading || status === "in_arbeit"}
            onClick={() => onUpdate("in_arbeit")}
          >
            In Arbeit setzen
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={loading || disabledErledigt}
            onClick={() => onUpdate("erledigt")}
          >
            Als erledigt markieren
          </button>
        </div>
        {disabledErledigt && (
          <p className="text-[11px] text-red-300">
            Für diese Aufgabe ist ein Beleg Pflicht. Bitte lade zuerst eine
            Datei hoch.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-cyan-400">
            Beleg hochladen (PNG / JPG / PDF)
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded border border-cyan-500/30 bg-card/60 p-2 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-cyan-400">
            Kommentar (optional, nur intern sichtbar)
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded border border-cyan-500/30 bg-card/60 p-2 text-xs"
          />
        </div>
      </div>

      {message && (
        <p className="text-xs text-cyan-400/80">
          {message}
        </p>
      )}
    </div>
  );
}

