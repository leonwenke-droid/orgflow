"use client";

import { useState } from "react";

export default function TreasuryUploadForm({
  organizationId,
  defaultCellRef
}: {
  organizationId?: string;
  defaultCellRef: string;
}) {
  const [mode, setMode] = useState<"excel" | "manual">("excel");
  const [file, setFile] = useState<File | null>(null);
  const [cellRef, setCellRef] = useState(defaultCellRef);
  const [manualAmount, setManualAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "excel" && !file) return;
    if (mode === "manual" && !manualAmount.trim()) return;

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("mode", mode);
    if (organizationId) formData.append("organization_id", organizationId);

    if (mode === "excel") {
      if (!file) return;
      formData.append("file", file);
      formData.append("cell_ref", cellRef.trim() || defaultCellRef);
    } else {
      formData.append("amount", manualAmount.trim());
    }

    const res = await fetch("/api/treasury/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    setLoading(false);
    setMessage(data.message || "Kassenstand aktualisiert.");
  };

  const isSubmitDisabled =
    loading ||
    (mode === "excel" && !file) ||
    (mode === "manual" && !manualAmount.trim());

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-sm">
      <div className="flex gap-4 text-xs text-cyan-300">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="treasury-mode"
            value="excel"
            checked={mode === "excel"}
            onChange={() => setMode("excel")}
            className="border-cyan-500/60"
          />
          Per Excel (.xlsx)
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="treasury-mode"
            value="manual"
            checked={mode === "manual"}
            onChange={() => setMode("manual")}
            className="border-cyan-500/60"
          />
          Manuell eingeben
        </label>
      </div>

      {mode === "excel" ? (
        <>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cyan-400">
              Excel-Datei (.xlsx)
            </label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded border border-cyan-500/30 bg-card/60 p-2 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-cyan-400">
              Zelle mit Kassenstand (z. B. M9)
            </label>
            <input
              type="text"
              value={cellRef}
              onChange={(e) => setCellRef(e.target.value.toUpperCase())}
              className="w-32 rounded border border-cyan-500/30 bg-card/60 p-1.5 text-xs"
            />
          </div>
        </>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-semibold text-cyan-400">
            Kassenstand in Euro
          </label>
          <input
            type="number"
            step="0.01"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            className="w-40 rounded border border-cyan-500/30 bg-card/60 p-1.5 text-xs"
            placeholder="z. B. 1234,56"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitDisabled}
        className="btn-primary text-xs"
      >
        {loading ? "Wird gespeichert…" : "Kassenstand aktualisieren"}
      </button>

      <p className="text-[11px] text-cyan-400/70">
        Nur das Finanzkomitee sollte den Kassenstand aktualisieren.
      </p>
      {message && (
        <p className="text-xs text-cyan-400/80">
          {message} – Dashboard aktualisiert sich automatisch.
        </p>
      )}
    </form>
  );
}

