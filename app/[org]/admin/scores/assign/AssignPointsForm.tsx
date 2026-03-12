"use client";

import { useState } from "react";
import { assignPoints } from "./actions";

type Member = { id: string; full_name: string };

export default function AssignPointsForm({
  orgSlug,
  members
}: {
  orgSlug: string;
  members: Member[];
}) {
  const [profileId, setProfileId] = useState("");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(points, 10);
    if (!profileId || isNaN(num)) {
      setMessage({ type: "error", text: "Mitglied wählen und Punkte (Zahl) angeben." });
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setMessage({ type: "error", text: "Bitte eine Begründung angeben." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const result = await assignPoints(orgSlug, profileId, num, trimmedReason);
    setLoading(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "ok", text: "Punkte wurden vergeben." });
    setPoints("");
    setReason("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700">
          Mitglied
        </label>
        <select
          required
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
        >
          <option value="">— wählen —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700">
          Punkte (positiv oder negativ)
        </label>
        <input
          type="number"
          required
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder="z. B. 10 oder -5"
          className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700">
          Begründung <span className="text-gray-500">(Pflicht)</span>
        </label>
        <textarea
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="z. B. Materialbeschaffung für Karnevalsparty, Veranstaltung unterstützt …"
          rows={3}
          className="w-full resize-y rounded border border-gray-300 bg-white p-2 text-sm"
        />
      </div>
      {message && (
        <p className={message.type === "error" ? "text-sm text-red-600" : "text-sm text-green-600"}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Wird gespeichert…" : "Punkte vergeben"}
      </button>
    </form>
  );
}
