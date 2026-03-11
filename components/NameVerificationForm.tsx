"use client";

import { useState } from "react";

type Props = {
  token: string;
  verifyAction: (token: string, name: string) => Promise<{ ok: boolean; message: string } | void>;
};

export default function NameVerificationForm({
  token,
  verifyAction
}: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await verifyAction(token, name);

    setLoading(false);

    if (result && !result.ok) {
      setError(result.message);
      return;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-cyan-400">
          Dein Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Max Mustermann"
          className="w-full rounded border border-cyan-500/30 bg-card/60 p-2 text-xs"
          autoFocus
          required
          disabled={loading}
        />
      </div>
      {error && (
        <p className="text-xs text-red-300">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary text-xs"
      >
        {loading ? "Prüfen…" : "Bestätigen"}
      </button>
    </form>
  );
}
